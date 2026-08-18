const boardElement = document.getElementById("board");
const messageElement = document.getElementById("message");
const resetBtn = document.getElementById("resetBtn");
const userCountElement = document.getElementById("userCount");
const pcCountElement = document.getElementById("pcCount");
const turnBox = document.getElementById("turnBox");

const USER = "user";
const PC = "pc";
const MAX_STONES = 3;

const nodes = [
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

let board = Array(9).fill(null);
let currentTurn = USER;
let gameOver = false;
let winLine = [];
let selectedNode = null;

function countStones(player) {
  return board.filter((owner) => owner === player).length;
}

function isMovementPhase() {
  return countStones(USER) === MAX_STONES && countStones(PC) === MAX_STONES;
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
    .map((owner, index) => owner === player ? index : null)
    .filter((nodeId) => nodeId !== null && getEmptyNeighbors(nodeId, testBoard).length > 0);
}

function renderBoard() {
  boardElement.innerHTML = "";
  const movementPhase = isMovementPhase();
  const availableMoves = selectedNode === null ? [] : getEmptyNeighbors(selectedNode);

  nodes.forEach((node) => {
    const button = document.createElement("button");
    button.className = "node";
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    button.setAttribute("aria-label", `Node ${node.id + 1}`);

    const owner = board[node.id];

    if (owner === USER) {
      button.classList.add("user");
      button.textContent = "●";
    } else if (owner === PC) {
      button.classList.add("pc");
      button.textContent = "●";
    } else {
      button.textContent = "+";
    }

    if (node.id === selectedNode) {
      button.classList.add("selected");
    }

    if (availableMoves.includes(node.id)) {
      button.classList.add("available");
      button.textContent = "+";
    }

    if (winLine.includes(node.id)) {
      button.classList.add("winning");
    }

    const canPlace = !movementPhase && owner === null && countStones(USER) < MAX_STONES;
    const canSelect = movementPhase && owner === USER && getEmptyNeighbors(node.id).length > 0;
    const canMoveHere = movementPhase && availableMoves.includes(node.id);

    button.disabled = gameOver || currentTurn !== USER || !(canPlace || canSelect || canMoveHere);
    button.addEventListener("click", () => handleUserClick(node.id));

    boardElement.appendChild(button);
  });

  userCountElement.textContent = countStones(USER);
  pcCountElement.textContent = countStones(PC);

  if (gameOver) {
    turnBox.textContent = "Game Over";
  } else if (currentTurn === USER) {
    turnBox.textContent = "Your Turn";
  } else {
    turnBox.textContent = "PC Turn";
  }
}

function handleUserClick(nodeId) {
  if (gameOver || currentTurn !== USER) return;

  if (!isMovementPhase()) {
    placeUserStone(nodeId);
    return;
  }

  moveUserStone(nodeId);
}

function placeUserStone(nodeId) {
  if (board[nodeId] !== null || countStones(USER) >= MAX_STONES) return;

  board[nodeId] = USER;

  if (finishTurnIfWinnerOrDraw(USER)) return;

  currentTurn = PC;
  messageElement.textContent = "PC is thinking...";
  renderBoard();
  setTimeout(handlePcTurn, 450);
}

function moveUserStone(nodeId) {
  if (selectedNode === null) {
    if (board[nodeId] === USER && getEmptyNeighbors(nodeId).length > 0) {
      selectedNode = nodeId;
      messageElement.textContent = "Now click the first connected empty node where you want to move.";
      renderBoard();
    }
    return;
  }

  if (nodeId === selectedNode) {
    selectedNode = null;
    messageElement.textContent = "Select one of your blue stones to move.";
    renderBoard();
    return;
  }

  if (board[nodeId] === USER && getEmptyNeighbors(nodeId).length > 0) {
    selectedNode = nodeId;
    messageElement.textContent = "Selected another stone. Choose a connected empty node.";
    renderBoard();
    return;
  }

  if (board[nodeId] === null && getEmptyNeighbors(selectedNode).includes(nodeId)) {
    board[selectedNode] = null;
    board[nodeId] = USER;
    selectedNode = null;

    if (finishTurnIfWinnerOrDraw(USER)) return;

    currentTurn = PC;
    messageElement.textContent = "PC is thinking...";
    renderBoard();
    setTimeout(handlePcTurn, 450);
  }
}

function handlePcTurn() {
  if (gameOver) return;

  if (!isMovementPhase()) {
    const placeMove = choosePcPlacement();
    if (placeMove !== null) {
      board[placeMove] = PC;
    }
  } else {
    const move = choosePcMovement();
    if (move === null) {
      gameOver = true;
      messageElement.textContent = "You win! PC has no stone that can move.";
      renderBoard();
      return;
    }
    board[move.from] = null;
    board[move.to] = PC;
  }

  if (finishTurnIfWinnerOrDraw(PC)) return;

  currentTurn = USER;
  if (isMovementPhase()) {
    const userMovable = getMovableStones(USER);
    if (userMovable.length === 0) {
      gameOver = true;
      messageElement.textContent = "PC wins! You have no stone that can move.";
    } else {
      messageElement.textContent = "Move phase. Select one of your blue stones.";
    }
  } else {
    messageElement.textContent = `Your turn. You have ${MAX_STONES - countStones(USER)} stone left.`;
  }
  renderBoard();
}

function finishTurnIfWinnerOrDraw(player) {
  const winner = findWinner(player);
  if (winner) {
    winLine = winner;
    gameOver = true;
    messageElement.textContent = player === USER
      ? "You win! You made 3 stones in a line."
      : "PC wins! PC made 3 stones in a line.";
    renderBoard();
    return true;
  }

  if (isMovementPhase()) {
    const otherPlayer = player === USER ? PC : USER;
    if (getMovableStones(otherPlayer).length === 0) {
      gameOver = true;
      messageElement.textContent = player === USER
        ? "You win! PC has no stone that can move."
        : "PC wins! You have no stone that can move.";
      renderBoard();
      return true;
    }
  }

  return false;
}

function choosePcPlacement() {
  const emptyNodes = board
    .map((owner, index) => owner === null ? index : null)
    .filter((index) => index !== null);

  for (const nodeId of emptyNodes) {
    const testBoard = [...board];
    testBoard[nodeId] = PC;
    if (findWinner(PC, testBoard)) return nodeId;
  }

  for (const nodeId of emptyNodes) {
    const testBoard = [...board];
    testBoard[nodeId] = USER;
    if (findWinner(USER, testBoard)) return nodeId;
  }

  if (board[4] === null) return 4;

  const corners = [0, 2, 6, 8].filter((id) => board[id] === null);
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  return emptyNodes[Math.floor(Math.random() * emptyNodes.length)] ?? null;
}

function choosePcMovement() {
  const possibleMoves = [];

  for (const from of getMovableStones(PC)) {
    for (const to of getEmptyNeighbors(from)) {
      possibleMoves.push({ from, to });
    }
  }

  for (const move of possibleMoves) {
    const testBoard = [...board];
    testBoard[move.from] = null;
    testBoard[move.to] = PC;
    if (findWinner(PC, testBoard)) return move;
  }

  for (const userFrom of getMovableStones(USER)) {
    for (const userTo of getEmptyNeighbors(userFrom)) {
      const testBoard = [...board];
      testBoard[userFrom] = null;
      testBoard[userTo] = USER;
      if (findWinner(USER, testBoard)) {
        const blockMove = possibleMoves.find((pcMove) => pcMove.to === userTo);
        if (blockMove) return blockMove;
      }
    }
  }

  const centerMove = possibleMoves.find((move) => move.to === 4);
  if (centerMove) return centerMove;

  return possibleMoves[Math.floor(Math.random() * possibleMoves.length)] ?? null;
}

function resetGame() {
  board = Array(9).fill(null);
  currentTurn = USER;
  gameOver = false;
  winLine = [];
  selectedNode = null;
  messageElement.textContent = "Your turn. Place your first stone.";
  renderBoard();
}

resetBtn.addEventListener("click", resetGame);
resetGame();
