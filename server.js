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

const PLAYER_ONE = "player1";
const PLAYER_TWO = "player2";
const MAX_STONES = 3;

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
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
  8: [5, 7, 4]
};

const rooms = new Map();
let waitingSocketId = null;

app.use(express.static(path.join(__dirname, "public")));

app.get("/room/:roomId", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function createRoomId() {
  let roomId;

  do {
    roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(roomId));

  return roomId;
}

function createRoom(roomId) {
  return {
    id: roomId,
    players: {},
    sockets: {},
    board: Array(9).fill(null),
    currentTurn: PLAYER_ONE,
    phase: "placing",
    selected: {},
    winner: null,
    winLine: [],
    moveCount: 0,
    rematchVotes: new Set()
  };
}

function getPlayerCount(room) {
  return Object.keys(room.players).length;
}

function countStones(room, player) {
  return room.board.filter((owner) => owner === player).length;
}

function isMovementPhase(room) {
  return countStones(room, PLAYER_ONE) === MAX_STONES && countStones(room, PLAYER_TWO) === MAX_STONES;
}

function otherPlayer(player) {
  return player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
}

function findWinner(board, player) {
  return winningLines.find((line) => line.every((nodeId) => board[nodeId] === player)) || null;
}

function getEmptyNeighbors(board, nodeId) {
  return neighbors[nodeId].filter((neighborId) => board[neighborId] === null);
}

function getMovableStones(room, player) {
  return room.board
    .map((owner, index) => (owner === player ? index : null))
    .filter((nodeId) => nodeId !== null && getEmptyNeighbors(room.board, nodeId).length > 0);
}

function getPublicRoomState(room) {
  return {
    roomId: room.id,
    board: room.board,
    currentTurn: room.currentTurn,
    phase: room.phase,
    winner: room.winner,
    winLine: room.winLine,
    moveCount: room.moveCount,
    rematchVotes: Array.from(room.rematchVotes),
    playerCount: getPlayerCount(room),
    maxPlayers: 2
  };
}

function emitRoomState(room) {
  io.to(room.id).emit("room-state", getPublicRoomState(room));
}

function joinRoom(socket, roomId) {
  let room = rooms.get(roomId);

  if (!room) {
    room = createRoom(roomId);
    rooms.set(roomId, room);
  }

  if (getPlayerCount(room) >= 2 && !room.players[socket.id]) {
    socket.emit("room-error", "This room is full.");
    return;
  }

  let player = room.players[socket.id];

  if (!player) {
    player = room.sockets[PLAYER_ONE] ? PLAYER_TWO : PLAYER_ONE;
    room.players[socket.id] = player;
    room.sockets[player] = socket.id;
  }

  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.player = player;

  socket.emit("joined-room", {
    roomId: room.id,
    player,
    state: getPublicRoomState(room)
  });

  emitRoomState(room);
}

function checkGameAfterMove(room, player) {
  const winLine = findWinner(room.board, player);

  if (winLine) {
    room.winner = player;
    room.winLine = winLine;
    return;
  }

  if (isMovementPhase(room)) {
    room.phase = "moving";
    const opponent = otherPlayer(player);

    if (getMovableStones(room, opponent).length === 0) {
      room.winner = player;
    }
  }
}

function handleOnlineAction(socket, data) {
  const room = rooms.get(socket.data.roomId);
  const player = socket.data.player;

  if (!room || room.winner) return;
  if (getPlayerCount(room) < 2) return socket.emit("room-error", "Waiting for another player to join.");
  if (room.currentTurn !== player) return socket.emit("room-error", "It is not your turn.");

  const nodeId = Number(data.nodeId);
  if (!Number.isInteger(nodeId) || nodeId < 0 || nodeId > 8) return;

  if (room.phase === "placing") {
    if (room.board[nodeId] !== null || countStones(room, player) >= MAX_STONES) return;

    room.board[nodeId] = player;
    room.moveCount += 1;
    room.rematchVotes.clear();
    checkGameAfterMove(room, player);

    if (!room.winner) {
      room.currentTurn = otherPlayer(player);
      if (isMovementPhase(room)) room.phase = "moving";
    }

    emitRoomState(room);
    return;
  }

  const selected = room.selected[player];

  if (selected === undefined || selected === null) {
    if (room.board[nodeId] === player && getEmptyNeighbors(room.board, nodeId).length > 0) {
      room.selected[player] = nodeId;
      socket.emit("stone-selected", {
        selectedNode: nodeId,
        availableMoves: getEmptyNeighbors(room.board, nodeId)
      });
    }
    return;
  }

  if (nodeId === selected) {
    room.selected[player] = null;
    socket.emit("stone-selected", { selectedNode: null, availableMoves: [] });
    return;
  }

  if (room.board[nodeId] === player && getEmptyNeighbors(room.board, nodeId).length > 0) {
    room.selected[player] = nodeId;
    socket.emit("stone-selected", {
      selectedNode: nodeId,
      availableMoves: getEmptyNeighbors(room.board, nodeId)
    });
    return;
  }

  if (room.board[nodeId] === null && getEmptyNeighbors(room.board, selected).includes(nodeId)) {
    room.board[selected] = null;
    room.board[nodeId] = player;
    room.selected[player] = null;
    room.moveCount += 1;
    room.rematchVotes.clear();
    checkGameAfterMove(room, player);

    if (!room.winner) {
      room.currentTurn = otherPlayer(player);
    }

    io.to(room.id).emit("stone-selected", { selectedNode: null, availableMoves: [] });
    emitRoomState(room);
  }
}

function resetRoomForRematch(room) {
  room.board = Array(9).fill(null);
  room.currentTurn = PLAYER_ONE;
  room.phase = "placing";
  room.selected = {};
  room.winner = null;
  room.winLine = [];
  room.moveCount = 0;
  room.rematchVotes.clear();
}

function handleRematchRequest(socket) {
  const room = rooms.get(socket.data.roomId);
  const player = socket.data.player;
  if (!room || !player) return;

  room.rematchVotes.add(player);

  if (room.rematchVotes.size >= 2 && getPlayerCount(room) === 2) {
    resetRoomForRematch(room);
    io.to(room.id).emit("rematch-started", getPublicRoomState(room));
    emitRoomState(room);
    return;
  }

  io.to(room.id).emit("rematch-status", {
    requestedBy: player,
    votes: Array.from(room.rematchVotes),
    needed: 2
  });
}

io.on("connection", (socket) => {
  socket.on("create-room", () => {
    const roomId = createRoomId();
    const room = createRoom(roomId);
    rooms.set(roomId, room);
    joinRoom(socket, roomId);
  });

  socket.on("join-room", (roomId) => {
    joinRoom(socket, String(roomId).trim().toUpperCase());
  });

  socket.on("random-match", () => {
    if (waitingSocketId && waitingSocketId !== socket.id) {
      const waitingSocket = io.sockets.sockets.get(waitingSocketId);
      waitingSocketId = null;

      if (waitingSocket) {
        const roomId = createRoomId();
        const room = createRoom(roomId);
        rooms.set(roomId, room);
        joinRoom(waitingSocket, roomId);
        joinRoom(socket, roomId);
      }

      return;
    }

    waitingSocketId = socket.id;
    socket.emit("waiting-random", "Searching for an online player...");
  });

  socket.on("online-action", (data) => handleOnlineAction(socket, data || {}));
  socket.on("request-rematch", () => handleRematchRequest(socket));

  socket.on("disconnect", () => {
    if (waitingSocketId === socket.id) waitingSocketId = null;

    const room = rooms.get(socket.data.roomId);
    const player = socket.data.player;
    if (!room || !player) return;

    delete room.players[socket.id];
    delete room.sockets[player];
    socket.to(room.id).emit("opponent-left", "Opponent left the game.");

    if (getPlayerCount(room) === 0) rooms.delete(room.id);
    else emitRoomState(room);
  });
});

server.listen(PORT, () => {
  console.log(`Three Stones server running on http://localhost:${PORT}`);
});
