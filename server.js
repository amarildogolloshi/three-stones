import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { db, getFullState, publicUser } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const SESSION_DAYS = 30;

app.use(express.json({ limit: "100kb" }));

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, salt, expectedHash) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function issueSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 86400000,
  ).toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(
    new Date().toISOString(),
  );
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

function authenticatedUser(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = db
    .prepare(
      `
    SELECT sessions.user_id, sessions.expires_at
    FROM sessions WHERE sessions.token = ?
  `,
    )
    .get(token);
  if (!session || session.expires_at <= new Date().toISOString()) {
    return res.status(401).json({ error: "Authentication required." });
  }
  req.userId = session.user_id;
  req.sessionToken = token;
  next();
}

app.post("/api/register", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const avatar = String(req.body?.avatar || "🐺").slice(0, 8);
  if (!/^[a-zA-Z0-9 _-]{2,18}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 2-18 characters." });
  }
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: "Password must be 6-72 characters." });
  }
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    return res.status(409).json({ error: "That username already exists." });
  }
  const id = crypto.randomUUID();
  const { salt, hash } = hashPassword(password);
  const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, username, password_hash, password_salt, avatar) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, username, hash, salt, avatar);
    db.prepare("INSERT INTO rewards (user_id) VALUES (?)").run(id);
  });
  create();
  const session = issueSession(id);
  return res.status(201).json({ ...session, state: getFullState(id) });
});

app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);
  if (
    !user ||
    !passwordMatches(password, user.password_salt, user.password_hash)
  ) {
    return res
      .status(401)
      .json({ error: "Username or password is not correct." });
  }
  const session = issueSession(user.id);
  return res.json({ ...session, state: getFullState(user.id) });
});

app.post("/api/logout", authenticatedUser, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(req.sessionToken);
  res.status(204).end();
});

app.get("/api/me", authenticatedUser, (req, res) => {
  res.json(getFullState(req.userId));
});

app.get("/api/leaderboard", (_req, res) => {
  const rows = db
    .prepare(
      `
    SELECT id, username, avatar, rating, games, wins, losses, best_time, fewest_moves
    FROM users ORDER BY rating DESC, wins DESC, username ASC LIMIT 100
  `,
    )
    .all();
  res.json(rows.map(publicUser));
});

app.put("/api/state", authenticatedUser, (req, res) => {
  const stats = req.body?.stats || {};
  const rewards = req.body?.rewards || {};
  const packs = req.body?.puzzleProgress || {};
  const save = db.transaction(() => {
    db.prepare(
      `
      UPDATE users SET rating = ?, games = ?, wins = ?, losses = ?, best_time = ?,
        fewest_moves = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `,
    ).run(
      Math.max(100, Number(stats.rating) || 1000),
      Math.max(0, Number(stats.games) || 0),
      Math.max(0, Number(stats.wins) || 0),
      Math.max(0, Number(stats.losses) || 0),
      stats.bestTime == null ? null : Math.max(0, Number(stats.bestTime) || 0),
      stats.fewestMoves == null
        ? null
        : Math.max(0, Number(stats.fewestMoves) || 0),
      req.userId,
    );
    db.prepare(
      `
      INSERT INTO rewards (user_id, coins, achievements_json, unlocked_themes_json,
        puzzles_solved, daily_reward_date, daily_streak)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET coins = excluded.coins,
        achievements_json = excluded.achievements_json,
        unlocked_themes_json = excluded.unlocked_themes_json,
        puzzles_solved = excluded.puzzles_solved,
        daily_reward_date = excluded.daily_reward_date,
        daily_streak = excluded.daily_streak,
        updated_at = CURRENT_TIMESTAMP
    `,
    ).run(
      req.userId,
      Math.max(0, Number(rewards.coins) || 0),
      JSON.stringify(
        Array.isArray(rewards.achievements) ? rewards.achievements : [],
      ),
      JSON.stringify(
        Array.isArray(rewards.unlockedThemes)
          ? rewards.unlockedThemes
          : ["classic", "dark"],
      ),
      Math.max(0, Number(rewards.puzzlesSolved) || 0),
      rewards.dailyRewardDate || null,
      Math.max(0, Number(rewards.dailyStreak) || 0),
    );
    const upsertPack = db.prepare(`
      INSERT INTO puzzle_progress (user_id, pack_id, solved, completed) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, pack_id) DO UPDATE SET solved = excluded.solved,
        completed = excluded.completed, updated_at = CURRENT_TIMESTAMP
    `);
    for (const [packId, progress] of Object.entries(packs)) {
      upsertPack.run(
        req.userId,
        packId,
        Math.max(0, Number(progress?.solved) || 0),
        progress?.completed ? 1 : 0,
      );
    }
  });
  save();
  res.json(getFullState(req.userId));
});

app.post("/api/matches", authenticatedUser, (req, res) => {
  const entry = req.body || {};
  if (!["win", "loss"].includes(entry.result))
    return res.status(400).json({ error: "Invalid result." });
  db.prepare(
    `
    INSERT INTO matches (user_id, result, mode, opponent, moves, seconds, rating_change)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    req.userId,
    entry.result,
    String(entry.mode || "pc").slice(0, 20),
    String(entry.opponent || "PC").slice(0, 40),
    Math.max(0, Number(entry.moves) || 0),
    Math.max(0, Number(entry.seconds) || 0),
    Number(entry.ratingChange) || 0,
  );
  res.status(201).json({ ok: true });
});

const P1 = "player1";
const P2 = "player2";
const MAX = 3;
const wins = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
const neighbors = {
  0: [1, 3, 4],
  1: [0, 2, 4],
  2: [1, 5, 4],
  3: [0, 4, 6],
  4: [0, 1, 2, 3, 5, 6, 7, 8],
  5: [2, 4, 8],
  6: [3, 7, 4],
  7: [6, 8, 4],
  8: [5, 7, 4],
};
const rooms = new Map();
let waiting = null;

app.use(express.static(path.join(__dirname, "public")));
app.get("/room/:roomId", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

function id() {
  let value;
  do value = Math.random().toString(36).slice(2, 8).toUpperCase();
  while (rooms.has(value));
  return value;
}
function room(id) {
  return {
    id,
    players: {},
    sockets: {},
    board: Array(9).fill(null),
    turn: P1,
    phase: "placing",
    selected: {},
    winner: null,
    winLine: [],
    moves: 0,
    votes: new Set(),
  };
}
function count(r, p) {
  return r.board.filter((x) => x === p).length;
}
function movement(r) {
  return count(r, P1) === MAX && count(r, P2) === MAX;
}
function other(p) {
  return p === P1 ? P2 : P1;
}
function winner(board, p) {
  return wins.find((line) => line.every((i) => board[i] === p)) || null;
}
function emptyNs(board, i) {
  return neighbors[i].filter((n) => board[n] === null);
}
function state(r) {
  return {
    roomId: r.id,
    board: r.board,
    currentTurn: r.turn,
    phase: r.phase,
    winner: r.winner,
    winLine: r.winLine,
    moveCount: r.moves,
    playerCount: Object.keys(r.players).length,
    rematchVotes: [...r.votes],
  };
}
function emit(r) {
  io.to(r.id).emit("room-state", state(r));
}
function join(socket, roomId) {
  let r = rooms.get(roomId);
  if (!r) {
    r = room(roomId);
    rooms.set(roomId, r);
  }
  if (Object.keys(r.players).length >= 2 && !r.players[socket.id])
    return socket.emit("room-error", "This room is full.");
  let player = r.players[socket.id];
  if (!player) {
    player = r.sockets[P1] ? P2 : P1;
    r.players[socket.id] = player;
    r.sockets[player] = socket.id;
  }
  socket.join(r.id);
  socket.data.roomId = r.id;
  socket.data.player = player;
  socket.emit("joined-room", { roomId: r.id, player, state: state(r) });
  emit(r);
}
function finish(r, p) {
  const line = winner(r.board, p);
  if (line) {
    r.winner = p;
    r.winLine = line;
    return;
  }
  if (movement(r)) r.phase = "moving";
  r.turn = other(p);
}
function action(socket, data) {
  const r = rooms.get(socket.data.roomId);
  const p = socket.data.player;
  const node = Number(data.nodeId);
  if (
    !r ||
    r.winner ||
    r.turn !== p ||
    !Number.isInteger(node) ||
    node < 0 ||
    node > 8
  )
    return;
  if (Object.keys(r.players).length < 2)
    return socket.emit("room-error", "Waiting for opponent.");
  if (r.phase === "placing") {
    if (r.board[node] !== null || count(r, p) >= MAX) return;
    r.board[node] = p;
    r.moves++;
    r.votes.clear();
    finish(r, p);
    emit(r);
    return;
  }
  const selected = r.selected[p];
  if (selected === undefined || selected === null) {
    if (r.board[node] === p && emptyNs(r.board, node).length) {
      r.selected[p] = node;
      socket.emit("stone-selected", {
        selectedNode: node,
        availableMoves: emptyNs(r.board, node),
      });
    }
    return;
  }
  if (node === selected) {
    r.selected[p] = null;
    socket.emit("stone-selected", { selectedNode: null, availableMoves: [] });
    return;
  }
  if (r.board[node] === p && emptyNs(r.board, node).length) {
    r.selected[p] = node;
    socket.emit("stone-selected", {
      selectedNode: node,
      availableMoves: emptyNs(r.board, node),
    });
    return;
  }
  if (r.board[node] === null && emptyNs(r.board, selected).includes(node)) {
    r.board[selected] = null;
    r.board[node] = p;
    r.selected[p] = null;
    r.moves++;
    r.votes.clear();
    finish(r, p);
    io.to(r.id).emit("stone-selected", {
      selectedNode: null,
      availableMoves: [],
    });
    emit(r);
  }
}
function reset(r) {
  r.board = Array(9).fill(null);
  r.turn = P1;
  r.phase = "placing";
  r.selected = {};
  r.winner = null;
  r.winLine = [];
  r.moves = 0;
  r.votes.clear();
}

io.on("connection", (socket) => {
  socket.on("create-room", () => join(socket, id()));
  socket.on("join-room", (rid) =>
    join(socket, String(rid).trim().toUpperCase()),
  );
  socket.on("random-match", () => {
    if (waiting && waiting !== socket.id) {
      const otherSock = io.sockets.sockets.get(waiting);
      waiting = null;
      if (otherSock) {
        const rid = id();
        rooms.set(rid, room(rid));
        join(otherSock, rid);
        join(socket, rid);
      }
      return;
    }
    waiting = socket.id;
    socket.emit("waiting-random", "Searching for an online player...");
  });
  socket.on("online-action", (data) => action(socket, data || {}));
  socket.on("request-rematch", () => {
    const r = rooms.get(socket.data.roomId);
    const p = socket.data.player;
    if (!r || !p) return;
    r.votes.add(p);
    if (r.votes.size >= 2) {
      reset(r);
      io.to(r.id).emit("rematch-started", state(r));
      emit(r);
    } else
      io.to(r.id).emit("rematch-status", { votes: [...r.votes], needed: 2 });
  });
  socket.on("disconnect", () => {
    if (waiting === socket.id) waiting = null;
    const r = rooms.get(socket.data.roomId);
    const p = socket.data.player;
    if (!r || !p) return;
    delete r.players[socket.id];
    delete r.sockets[p];
    socket.to(r.id).emit("opponent-left", "Opponent left the game.");
    if (Object.keys(r.players).length === 0) rooms.delete(r.id);
    else emit(r);
  });
});
server.listen(PORT, () =>
  console.log(`Three Stones running at http://localhost:${PORT}`),
);
