const socket = io();

const PLAYER_ONE = "player1";
const PLAYER_TWO = "player2";
const MAX_STONES = 3;

const nodePositions = [
  { id: 0, x: 15, y: 15 },
  { id: 1, x: 50, y: 15 },
  { id: 2, x: 85, y: 15 },
  { id: 3, x: 15, y: 50 },
  { id: 4, x: 50, y: 50 },
  { id: 5, x: 85, y: 50 },
  { id: 6, x: 15, y: 85 },
  { id: 7, x: 50, y: 85 },
  { id: 8, x: 85, y: 85 }
];

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

const screens = document.querySelectorAll(".screen");
const boardNodes = document.getElementById("boardNodes");
const message = document.getElementById("message");
const turnBox = document.getElementById("turnBox");
const playerOneCount = document.getElementById("playerOneCount");
const playerTwoCount = document.getElementById("playerTwoCount");
const playerTwoLabel = document.getElementById("playerTwoLabel");
const gameModeText = document.getElementById("gameModeText");
const onlineInfo = document.getElementById("onlineInfo");
const onlineRoomBadge = document.getElementById("onlineRoomBadge");
const connectionBadge = document.getElementById("connectionBadge");
const createdRoomBox = document.getElementById("createdRoomBox");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomLinkInput = document.getElementById("roomLinkInput");
const friendStatus = document.getElementById("friendStatus");
const randomStatus = document.getElementById("randomStatus");

let mode = "pc";
let myOnlinePlayer = null;
let currentRoomId = null;
let board = Array(9).fill(null);
let currentTurn = PLAYER_ONE;
let phase = "placing";
let winner = null;
let winLine = [];
let selectedNode = null;
let availableMoves = [];

function showScreen(screenId) {
  screens.forEach((screen) => screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

function countStones(player) {
  return board.filter((owner) => owner === player).length;
}

function isMovementPhase() {
  return countStones(PLAYER_ONE) === MAX_STONES && countStones(PLAYER_TWO) === MAX_STONES;
}

function otherPlayer(player) {
  return player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
}

function findWinner(player, testBoard = board) {
  for (const line of winningLines) {
    if (line.every((nodeId) => testBoard[nodeId] === player)) {
      return line;
    }
  }

  return null;
}

function getEmptyNeighbors(nodeId, testBoard = board) {
  return neighbors[nodeId].filter((neighborId) => testBoard[neighborId] === null);
}

function getMovableStones(player, testBoard = board) {
  return testBoard
    .map((owner, index) => (owner === player ? index : null))
    .filter((nodeId) => nodeId !== null && getEmptyNeighbors(nodeId, testBoard).length > 0);
}

function renderBoard() {
  boardNodes.innerHTML = "";

  nodePositions.forEach((node) => {
    const button = document.createElement("button");
    const owner = board[node.id];

    button.className = "node";
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    button.textContent = owner ? "●" : "+";

    if (owner === PLAYER_ONE) {
      button.classList.add("player-one");
    }

    if (owner === PLAYER_TWO) {
      button.classList.add("player-two");
    }

    if (selectedNode === node.id) {
      button.classList.add("selected");
    }

    if (availableMoves.includes(node.id)) {
      button.classList.add("available");
    }

    if (winLine.includes(node.id)) {
      button.classList.add("winning");
    }

    button.disabled = !canClickNode(node.id);
    button.addEventListener("click", () => handleNodeClick(node.id));
    boardNodes.appendChild(button);
  });

  playerOneCount.textContent = countStones(PLAYER_ONE);
  playerTwoCount.textContent = countStones(PLAYER_TWO);

  if (winner) {
    turnBox.textContent = "Game Over";
  } else if (mode === "pc") {
    turnBox.textContent = currentTurn === PLAYER_ONE ? "Your Turn" : "PC Turn";
  } else {
    turnBox.textContent = currentTurn === myOnlinePlayer ? "Your Turn" : "Opponent Turn";
  }
}

function canClickNode(nodeId) {
  if (winner) {
    return false;
  }

  if (mode !== "pc") {
    return currentTurn === myOnlinePlayer;
  }

  if (currentTurn !== PLAYER_ONE) {
    return false;
  }

  if (!isMovementPhase()) {
    return board[nodeId] === null && countStones(PLAYER_ONE) < MAX_STONES;
  }

  if (selectedNode === null) {
    return board[nodeId] === PLAYER_ONE && getEmptyNeighbors(nodeId).length > 0;
  }

  return nodeId === selectedNode || board[nodeId] === PLAYER_ONE || availableMoves.includes(nodeId);
}

function handleNodeClick(nodeId) {
  if (mode !== "pc") {
    socket.emit("online-action", { nodeId });
    return;
  }

  if (isMovementPhase()) {
    moveLocalStone(nodeId);
  } else {
    placeLocalStone(nodeId);
  }
}

function placeLocalStone(nodeId) {
  if (board[nodeId] !== null) {
    return;
  }

  board[nodeId] = PLAYER_ONE;

  if (finishLocalTurn(PLAYER_ONE)) {
    return;
  }

  currentTurn = PLAYER_TWO;
  message.textContent = "PC is thinking...";
  renderBoard();
  setTimeout(handlePcTurn, 450);
}

function moveLocalStone(nodeId) {
  if (selectedNode === null) {
    if (board[nodeId] === PLAYER_ONE && getEmptyNeighbors(nodeId).length > 0) {
      selectedNode = nodeId;
      availableMoves = getEmptyNeighbors(nodeId);
      message.textContent = "Choose a green connected node.";
      renderBoard();
    }

    return;
  }

  if (nodeId === selectedNode) {
    selectedNode = null;
    availableMoves = [];
    message.textContent = "Select one of your stones to move.";
    renderBoard();
    return;
  }

  if (board[nodeId] === PLAYER_ONE && getEmptyNeighbors(nodeId).length > 0) {
    selectedNode = nodeId;
    availableMoves = getEmptyNeighbors(nodeId);
    renderBoard();
    return;
  }

  if (availableMoves.includes(nodeId)) {
    board[selectedNode] = null;
    board[nodeId] = PLAYER_ONE;
    selectedNode = null;
    availableMoves = [];

    if (finishLocalTurn(PLAYER_ONE)) {
      return;
    }

    currentTurn = PLAYER_TWO;
    message.textContent = "PC is thinking...";
    renderBoard();
    setTimeout(handlePcTurn, 450);
  }
}

function finishLocalTurn(player) {
  const line = findWinner(player);

  if (line) {
    winner = player;
    winLine = line;
    message.textContent = player === PLAYER_ONE ? "You win!" : "PC wins!";
    renderBoard();
    return true;
  }

  if (isMovementPhase()) {
    phase = "moving";
    const opponent = otherPlayer(player);

    if (getMovableStones(opponent).length === 0) {
      winner = player;
      message.textContent = player === PLAYER_ONE
        ? "You win! PC cannot move."
        : "PC wins! You cannot move.";
      renderBoard();
      return true;
    }
  }

  return false;
}

function handlePcTurn() {
  if (winner) {
    return;
  }

  if (isMovementPhase()) {
    const move = choosePcMovement();

    if (!move) {
      winner = PLAYER_ONE;
      message.textContent = "You win! PC cannot move.";
      renderBoard();
      return;
    }

    board[move.from] = null;
    board[move.to] = PLAYER_TWO;
  } else {
    const nodeId = choosePcPlacement();
    board[nodeId] = PLAYER_TWO;
  }

  if (finishLocalTurn(PLAYER_TWO)) {
    return;
  }

  currentTurn = PLAYER_ONE;
  message.textContent = isMovementPhase()
    ? "Move phase. Select one stone."
    : "Your turn.";
  renderBoard();
}

function choosePcPlacement() {
  const emptyNodes = board
    .map((owner, index) => (owner === null ? index : null))
    .filter((index) => index !== null);

  for (const nodeId of emptyNodes) {
    const testBoard = [...board];
    testBoard[nodeId] = PLAYER_TWO;

    if (findWinner(PLAYER_TWO, testBoard)) {
      return nodeId;
    }
  }

  for (const nodeId of emptyNodes) {
    const testBoard = [...board];
    testBoard[nodeId] = PLAYER_ONE;

    if (findWinner(PLAYER_ONE, testBoard)) {
      return nodeId;
    }
  }

  if (board[4] === null) {
    return 4;
  }

  return emptyNodes[Math.floor(Math.random() * emptyNodes.length)];
}

function choosePcMovement() {
  const possibleMoves = [];

  for (const from of getMovableStones(PLAYER_TWO)) {
    for (const to of getEmptyNeighbors(from)) {
      possibleMoves.push({ from, to });
    }
  }

  for (const move of possibleMoves) {
    const testBoard = [...board];
    testBoard[move.from] = null;
    testBoard[move.to] = PLAYER_TWO;

    if (findWinner(PLAYER_TWO, testBoard)) {
      return move;
    }
  }

  return possibleMoves[Math.floor(Math.random() * possibleMoves.length)] || null;
}

function resetLocalGame() {
  mode = "pc";
  myOnlinePlayer = null;
  currentRoomId = null;
  board = Array(9).fill(null);
  currentTurn = PLAYER_ONE;
  phase = "placing";
  winner = null;
  winLine = [];
  selectedNode = null;
  availableMoves = [];

  gameModeText.textContent = "Play vs PC";
  playerTwoLabel.textContent = "PC";
  onlineInfo.classList.add("hidden");
  message.textContent = "Your turn.";

  renderBoard();
}

function applyOnlineState(state) {
  board = state.board;
  currentTurn = state.currentTurn;
  phase = state.phase;
  winner = state.winner;
  winLine = state.winLine || [];

  if (state.playerCount < 2) {
    message.textContent = "Waiting for another player to join.";
  } else if (winner) {
    message.textContent = winner === myOnlinePlayer ? "You win!" : "Opponent wins.";
  } else if (currentTurn === myOnlinePlayer) {
    message.textContent = phase === "moving"
      ? "Your turn. Move one stone."
      : "Your turn. Place one stone.";
  } else {
    message.textContent = "Waiting for opponent move.";
  }

  renderBoard();
}

document.getElementById("playPcBtn").addEventListener("click", () => {
  resetLocalGame();
  showScreen("gameScreen");
});

document.getElementById("playOnlineBtn").addEventListener("click", () => {
  showScreen("onlineMenuScreen");
});

document.getElementById("friendModeBtn").addEventListener("click", () => {
  showScreen("friendScreen");
});

document.getElementById("randomModeBtn").addEventListener("click", () => {
  mode = "random";
  randomStatus.textContent = "Searching for an online player...";
  showScreen("randomScreen");
  socket.emit("random-match");
});

document.getElementById("createRoomBtn").addEventListener("click", () => {
  mode = "online";
  friendStatus.textContent = "Creating room...";
  socket.emit("create-room");
});

document.getElementById("joinRoomBtn").addEventListener("click", () => {
  const roomCode = document.getElementById("joinCodeInput").value.trim().toUpperCase();

  if (!roomCode) {
    friendStatus.textContent = "Please enter a room code.";
    return;
  }

  mode = "online";
  friendStatus.textContent = "Joining room...";
  socket.emit("join-room", roomCode);
});

document.getElementById("copyCodeBtn").addEventListener("click", async () => {
  if (!currentRoomId) {
    return;
  }

  await navigator.clipboard.writeText(currentRoomId);
  friendStatus.textContent = "Room code copied.";
});

document.getElementById("copyLinkBtn").addEventListener("click", async () => {
  if (!roomLinkInput.value) {
    return;
  }

  await navigator.clipboard.writeText(roomLinkInput.value);
  friendStatus.textContent = "Room link copied.";
});

document.getElementById("newGameBtn").addEventListener("click", () => {
  if (mode === "pc") {
    resetLocalGame();
  } else {
    message.textContent = "For an online rematch, create a new room.";
  }
});

document.getElementById("exitGameBtn").addEventListener("click", () => {
  showScreen("homeScreen");
});

document.querySelectorAll(".back-btn[data-screen]").forEach((button) => {
  button.addEventListener("click", () => {
    showScreen(button.dataset.screen);
  });
});

socket.on("joined-room", ({ roomId, player, state }) => {
  myOnlinePlayer = player;
  currentRoomId = roomId;
  selectedNode = null;
  availableMoves = [];

  const roomLink = `${window.location.origin}/room/${roomId}`;

  createdRoomBox.classList.remove("hidden");
  roomCodeDisplay.textContent = roomId;
  roomLinkInput.value = roomLink;
  onlineRoomBadge.textContent = `Room: ${roomId}`;
  onlineInfo.classList.remove("hidden");
  playerTwoLabel.textContent = "Friend";
  connectionBadge.textContent = "🟢 Connected";

  gameModeText.textContent = mode === "random" ? "Random Opponent" : "Play with Friend";
  randomStatus.textContent = "Opponent found. Starting match...";
  friendStatus.textContent = player === PLAYER_ONE
    ? "Room created. Send the link or code to your friend."
    : "Joined room. Game ready.";

  window.history.replaceState({}, "", `/room/${roomId}`);
  showScreen("gameScreen");
  applyOnlineState(state);
});

socket.on("room-state", (state) => {
  if (!myOnlinePlayer) {
    return;
  }

  applyOnlineState(state);
});

socket.on("stone-selected", ({ selectedNode: nodeId, availableMoves: moves }) => {
  selectedNode = nodeId;
  availableMoves = moves || [];
  renderBoard();
});

socket.on("waiting-random", (text) => {
  randomStatus.textContent = text;
});

socket.on("room-error", (text) => {
  friendStatus.textContent = text;
  message.textContent = text;
});

socket.on("opponent-left", (text) => {
  connectionBadge.textContent = "🔴 Disconnected";
  message.textContent = text;
});

const roomMatch = window.location.pathname.match(/^\/room\/([A-Z0-9]+)$/i);

if (roomMatch) {
  mode = "online";
  socket.emit("join-room", roomMatch[1]);
  friendStatus.textContent = "Joining room...";
} else {
  resetLocalGame();
}
