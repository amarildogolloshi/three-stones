import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

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
