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

const $ = (id) => document.getElementById(id);

const screens = document.querySelectorAll(".screen");
const boardNodes = $("boardNodes");
const message = $("message");
const turnBox = $("turnBox");
const playerOneCount = $("playerOneCount");
const playerTwoCount = $("playerTwoCount");
const playerOneLabel = $("playerOneLabel");
const playerTwoLabel = $("playerTwoLabel");
const gameModeText = $("gameModeText");
const onlineInfo = $("onlineInfo");
const onlineRoomBadge = $("onlineRoomBadge");
const connectionBadge = $("connectionBadge");
const createdRoomBox = $("createdRoomBox");
const roomCodeDisplay = $("roomCodeDisplay");
const roomLinkInput = $("roomLinkInput");
const friendStatus = $("friendStatus");
const randomStatus = $("randomStatus");
const playerNameInput = $("playerNameInput");
const difficultySelect = $("difficultySelect");
const soundToggle = $("soundToggle");
const moveCounter = $("moveCounter");
const timerDisplay = $("timerDisplay");
const difficultyDisplay = $("difficultyDisplay");
const rematchBtn = $("rematchBtn");
const fireworks = $("fireworks");
const rankTitle = $("rankTitle");
const rankPoints = $("rankPoints");
const statGames = $("statGames");
const statWins = $("statWins");
const statWinRate = $("statWinRate");
const detailRankTitle = $("detailRankTitle");
const detailRankPoints = $("detailRankPoints");
const detailGames = $("detailGames");
const detailWins = $("detailWins");
const detailLosses = $("detailLosses");
const detailWinRate = $("detailWinRate");
const detailBestTime = $("detailBestTime");
const detailFewestMoves = $("detailFewestMoves");
const matchHistoryList = $("matchHistoryList");
const themeSelect = $("themeSelect");
const pieceSelect = $("pieceSelect");
const dailyPuzzleSubtitle = $("dailyPuzzleSubtitle");
const challengeBadge = $("challengeBadge");
const puzzleInstruction = $("puzzleInstruction");
const puzzleStatus = $("puzzleStatus");
const tournamentSizeSelect = $("tournamentSizeSelect");
const tournamentNamesInput = $("tournamentNamesInput");
const tournamentBracket = $("tournamentBracket");
const tournamentRoundTitle = $("tournamentRoundTitle");
const bracketList = $("bracketList");
const tournamentStatus = $("tournamentStatus");
const playTournamentMatchBtn = $("playTournamentMatchBtn");

let mode = "pc";
let playerName = "Player";
let difficulty = "medium";
let soundEnabled = true;
let myOnlinePlayer = null;
let currentRoomId = null;
let board = Array(9).fill(null);
let currentTurn = PLAYER_ONE;
let phase = "placing";
let winner = null;
let winLine = [];
let selectedNode = null;
let availableMoves = [];
let totalMoves = 0;
let elapsedSeconds = 0;
let timerId = null;
let audioContext = null;
let lastRecordedGameKey = null;
let currentTheme = "classic";
let currentPieces = "dots";
let activePuzzle = null;
let currentPuzzleIndex = 0;
let tournament = null;

const STATS_KEY = "threeStonesStatsV23";
const CUSTOMIZATION_KEY = "threeStonesCustomizationV24";
const PUZZLE_KEY = "threeStonesPuzzleV25";

const pieceSets = {
  dots: { one: "●", two: "●", empty: "+" },
  stars: { one: "★", two: "★", empty: "+" },
  gems: { one: "◆", two: "◆", empty: "+" },
  shields: { one: "⬟", two: "⬟", empty: "+" },
  animals: { one: "🐺", two: "🦊", empty: "+" }
};

const puzzleBank = [
  {
    title: "Win in 1",
    instruction: "Place your blue stone on the center node to complete the diagonal.",
    board: [PLAYER_ONE, null, PLAYER_TWO, null, null, PLAYER_TWO, null, null, PLAYER_ONE],
    phase: "placing",
    solution: 4
  },
  {
    title: "Win in 1",
    instruction: "Place your blue stone on the middle-right node to complete the center row.",
    board: [PLAYER_TWO, null, null, PLAYER_ONE, PLAYER_ONE, null, null, PLAYER_TWO, null],
    phase: "placing",
    solution: 5
  },
  {
    title: "Move to Win",
    instruction: "Move the selected blue stone from the center to the top-right node to complete the top row.",
    board: [PLAYER_ONE, PLAYER_ONE, null, PLAYER_TWO, PLAYER_ONE, PLAYER_TWO, PLAYER_TWO, null, null],
    phase: "moving",
    solutionFrom: 4,
    solution: 2
  },
  {
    title: "Win in 1",
    instruction: "Place your blue stone on the bottom-middle node to complete the column.",
    board: [PLAYER_TWO, PLAYER_ONE, null, null, PLAYER_ONE, PLAYER_TWO, null, null, null],
    phase: "placing",
    solution: 7
  }
];

function showScreen(screenId) {
  screens.forEach((screen) => screen.classList.remove("active"));
  $(screenId).classList.add("active");
}

function bodySetMode(modeName) {
  document.body.classList.remove("puzzle-active", "tournament-active");
  if (modeName === "puzzle") document.body.classList.add("puzzle-active");
  if (modeName === "tournament") document.body.classList.add("tournament-active");
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
  return winningLines.find((line) => line.every((nodeId) => testBoard[nodeId] === player)) || null;
}

function getEmptyNeighbors(nodeId, testBoard = board) {
  return neighbors[nodeId].filter((neighborId) => testBoard[neighborId] === null);
}

function getMovableStones(player, testBoard = board) {
  return testBoard
    .map((owner, index) => (owner === player ? index : null))
    .filter((nodeId) => nodeId !== null && getEmptyNeighbors(nodeId, testBoard).length > 0);
}

function formatTime(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return "--:--";
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  stopTimer();
  elapsedSeconds = 0;
  updateTimerDisplay();
  timerId = setInterval(() => {
    elapsedSeconds += 1;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(elapsedSeconds);
}

function playSound(type) {
  if (!soundEnabled) return;
  if (!audioContext) audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  const frequencies = { place: 360, move: 520, win: 760, error: 180 };

  oscillator.frequency.setValueAtTime(frequencies[type] || 360, now);
  oscillator.type = type === "win" ? "triangle" : "sine";
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.2);
}

function showFireworks() {
  fireworks.classList.remove("hidden");
  fireworks.innerHTML = "";

  for (let i = 0; i < 18; i += 1) {
    const dot = document.createElement("span");
    dot.className = "firework";
    dot.style.left = `${10 + Math.random() * 80}%`;
    dot.style.top = `${10 + Math.random() * 70}%`;
    dot.style.background = ["#facc15", "#22c55e", "#38bdf8", "#fb7185"][i % 4];
    fireworks.appendChild(dot);
  }

  setTimeout(() => {
    fireworks.classList.add("hidden");
    fireworks.innerHTML = "";
  }, 1200);
}

function createDefaultStats() {
  return {
    rating: 1000,
    games: 0,
    wins: 0,
    losses: 0,
    bestTime: null,
    fewestMoves: null,
    history: []
  };
}

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || createDefaultStats();
  } catch {
    return createDefaultStats();
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function getRankName(rating) {
  if (rating >= 1800) return "Diamond";
  if (rating >= 1600) return "Platinum";
  if (rating >= 1400) return "Gold";
  if (rating >= 1200) return "Silver";
  return "Bronze";
}

function calculateRatingChange(result, gameMode) {
  const base = gameMode === "pc" ? 18 : 26;
  if (result === "win") return base;
  if (result === "loss") return -base;
  return 4;
}

function recordMatch(result, gameMode, opponentName) {
  const stats = loadStats();
  const ratingChange = calculateRatingChange(result, gameMode);

  stats.games += 1;
  if (result === "win") stats.wins += 1;
  if (result === "loss") stats.losses += 1;
  stats.rating = Math.max(100, stats.rating + ratingChange);

  if (result === "win") {
    if (stats.bestTime === null || elapsedSeconds < stats.bestTime) stats.bestTime = elapsedSeconds;
    if (stats.fewestMoves === null || totalMoves < stats.fewestMoves) stats.fewestMoves = totalMoves;
  }

  stats.history.unshift({
    id: Date.now(),
    result,
    mode: gameMode,
    opponent: opponentName,
    moves: totalMoves,
    seconds: elapsedSeconds,
    ratingChange,
    date: new Date().toLocaleString()
  });

  stats.history = stats.history.slice(0, 20);
  saveStats(stats);
  updateStatsUI();
}

function updateStatsUI() {
  const stats = loadStats();
  const rank = getRankName(stats.rating);
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;

  rankTitle.textContent = rank;
  rankPoints.textContent = `${stats.rating} RP`;
  statGames.textContent = stats.games;
  statWins.textContent = stats.wins;
  statWinRate.textContent = `${winRate}%`;
  detailRankTitle.textContent = rank;
  detailRankPoints.textContent = stats.rating;
  detailGames.textContent = stats.games;
  detailWins.textContent = stats.wins;
  detailLosses.textContent = stats.losses;
  detailWinRate.textContent = `${winRate}%`;
  detailBestTime.textContent = formatTime(stats.bestTime);
  detailFewestMoves.textContent = stats.fewestMoves === null ? "--" : stats.fewestMoves;
  matchHistoryList.innerHTML = "";

  if (stats.history.length === 0) {
    matchHistoryList.innerHTML = '<p class="history-meta">No matches yet. Play a game to start your history.</p>';
    return;
  }

  stats.history.forEach((match) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const symbol = match.result === "win" ? "W" : match.result === "loss" ? "L" : "D";
    const ratingText = match.ratingChange > 0 ? `+${match.ratingChange}` : String(match.ratingChange);

    item.innerHTML = `
      <div class="history-result ${match.result}">${symbol}</div>
      <div>
        <strong>${match.mode === "pc" ? "vs PC" : "Online"} ${match.opponent ? `vs ${match.opponent}` : ""}</strong>
        <div class="history-meta">${match.date} • ${match.moves} moves • ${formatTime(match.seconds)}</div>
      </div>
      <div class="history-rp">${ratingText} RP</div>
    `;

    matchHistoryList.appendChild(item);
  });
}

function resetStats() {
  saveStats(createDefaultStats());
  updateStatsUI();
}

function loadCustomization() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMIZATION_KEY)) || { theme: "classic", pieces: "dots" };
  } catch {
    return { theme: "classic", pieces: "dots" };
  }
}

function saveCustomization() {
  localStorage.setItem(CUSTOMIZATION_KEY, JSON.stringify({ theme: currentTheme, pieces: currentPieces }));
}

function applyCustomization(theme = currentTheme, pieces = currentPieces) {
  document.body.classList.remove(
    "theme-classic",
    "theme-dark",
    "theme-wood",
    "theme-neon",
    "theme-stone",
    "theme-space",
    "pieces-dots",
    "pieces-stars",
    "pieces-gems",
    "pieces-shields",
    "pieces-animals"
  );

  document.body.classList.add(`theme-${theme}`, `pieces-${pieces}`);
  currentTheme = theme;
  currentPieces = pieces;
  themeSelect.value = theme;
  pieceSelect.value = pieces;
  renderBoard();
}

function getPieceSymbol(owner) {
  const set = pieceSets[currentPieces] || pieceSets.dots;
  if (owner === PLAYER_ONE) return set.one;
  if (owner === PLAYER_TWO) return set.two;
  return set.empty;
}

function getTodayPuzzleIndex() {
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  return [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % puzzleBank.length;
}

function loadPuzzleProgress() {
  try {
    return JSON.parse(localStorage.getItem(PUZZLE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePuzzleProgress(progress) {
  localStorage.setItem(PUZZLE_KEY, JSON.stringify(progress));
}

function updatePuzzleScreen() {
  const index = getTodayPuzzleIndex();
  const puzzle = puzzleBank[index];
  const dateKey = new Date().toISOString().slice(0, 10);
  const progress = loadPuzzleProgress();

  dailyPuzzleSubtitle.textContent = `Today's puzzle: ${dateKey}`;
  challengeBadge.textContent = puzzle.title;
  puzzleInstruction.textContent = puzzle.instruction;
  puzzleStatus.textContent = progress[dateKey] ? "Completed today. You can still practice." : "Puzzle ready.";
}

function startPuzzle(index = getTodayPuzzleIndex(), isPractice = false) {
  const puzzle = puzzleBank[index];
  activePuzzle = { ...puzzle, index, isPractice };
  mode = "puzzle";
  board = [...puzzle.board];
  currentTurn = PLAYER_ONE;
  phase = puzzle.phase;
  winner = null;
  winLine = [];
  selectedNode = puzzle.solutionFrom ?? null;
  availableMoves = selectedNode === null ? [] : getEmptyNeighbors(selectedNode);
  totalMoves = 0;

  bodySetMode("puzzle");
  gameModeText.textContent = isPractice ? "Practice Puzzle" : "Daily Puzzle";
  message.textContent = puzzle.instruction;
  rematchBtn.disabled = false;
  rematchBtn.textContent = "Try Again";
  rematchBtn.classList.add("hidden");
  onlineInfo.classList.add("hidden");
  startTimer();
  renderBoard();
  showScreen("gameScreen");
}

function completePuzzle(success) {
  stopTimer();
  const finishedPuzzle = activePuzzle;

  if (success) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const progress = loadPuzzleProgress();

    if (!activePuzzle.isPractice) {
      progress[dateKey] = true;
      savePuzzleProgress(progress);
    }

    message.textContent = activePuzzle.isPractice ? "Practice puzzle solved!" : "Daily puzzle solved!";
    showFireworks();
    playSound("win");
  } else {
    message.textContent = "Not the best move. Click Try Again to reset this puzzle.";
    playSound("error");
  }

  activePuzzle = finishedPuzzle;
  rematchBtn.classList.remove("hidden");
  rematchBtn.disabled = false;
  rematchBtn.textContent = "Try Again";
  updatePuzzleScreen();
}

function renderBoard() {
  boardNodes.innerHTML = "";

  nodePositions.forEach((node) => {
    const button = document.createElement("button");
    const owner = board[node.id];

    button.className = "node";
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    button.textContent = getPieceSymbol(owner);

    if (owner === PLAYER_ONE) button.classList.add("player-one");
    if (owner === PLAYER_TWO) button.classList.add("player-two");
    if (selectedNode === node.id) button.classList.add("selected");
    if (availableMoves.includes(node.id)) button.classList.add("available");
    if (winLine.includes(node.id)) button.classList.add("winning");

    button.disabled = !canClickNode(node.id);
    button.addEventListener("click", () => handleNodeClick(node.id));
    button.addEventListener("pointerdown", () => handlePointerSelect(node.id));
    button.addEventListener("pointerup", () => handlePointerRelease(node.id));
    boardNodes.appendChild(button);
  });

  playerOneCount.textContent = countStones(PLAYER_ONE);
  playerTwoCount.textContent = countStones(PLAYER_TWO);
  playerOneLabel.textContent = mode === "online" || mode === "random" ? (myOnlinePlayer === PLAYER_ONE ? playerName : "Friend") : playerName;
  playerTwoLabel.textContent = mode === "online" || mode === "random" ? (myOnlinePlayer === PLAYER_TWO ? playerName : "Friend") : "PC";
  moveCounter.textContent = totalMoves;
  difficultyDisplay.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);

  if (winner) turnBox.textContent = "Game Over";
  else if (mode === "online" || mode === "random") turnBox.textContent = currentTurn === myOnlinePlayer ? "Your Turn" : "Opponent Turn";
  else turnBox.textContent = currentTurn === PLAYER_ONE ? "Your Turn" : "PC Turn";
}

function canClickNode(nodeId) {
  if (winner) return false;

  if (mode === "online" || mode === "random") {
    return currentTurn === myOnlinePlayer;
  }

  if (currentTurn !== PLAYER_ONE) return false;

  if (mode === "puzzle") {
    if (phase === "placing") return board[nodeId] === null;
    if (selectedNode === null) return board[nodeId] === PLAYER_ONE && getEmptyNeighbors(nodeId).length > 0;
    return nodeId === selectedNode || board[nodeId] === PLAYER_ONE || availableMoves.includes(nodeId);
  }

  if (!isMovementPhase()) return board[nodeId] === null && countStones(PLAYER_ONE) < MAX_STONES;
  if (selectedNode === null) return board[nodeId] === PLAYER_ONE && getEmptyNeighbors(nodeId).length > 0;
  return nodeId === selectedNode || board[nodeId] === PLAYER_ONE || availableMoves.includes(nodeId);
}

function handlePointerSelect(nodeId) {
  if ((mode === "pc" || mode === "tournament") && (isMovementPhase() || phase === "moving") && board[nodeId] === PLAYER_ONE) {
    selectedNode = nodeId;
    availableMoves = getEmptyNeighbors(nodeId);
    renderBoard();
  }
}

function handlePointerRelease(nodeId) {
  if ((mode === "pc" || mode === "tournament") && (isMovementPhase() || phase === "moving") && selectedNode !== null && availableMoves.includes(nodeId)) {
    moveLocalStone(nodeId);
  }
}

function handleNodeClick(nodeId) {
  if (mode === "online" || mode === "random") {
    socket.emit("online-action", { nodeId });
    return;
  }

  if (mode === "puzzle") {
    phase === "moving" ? moveLocalStone(nodeId) : placeLocalStone(nodeId);
    return;
  }

  isMovementPhase() ? moveLocalStone(nodeId) : placeLocalStone(nodeId);
}

function placeLocalStone(nodeId) {
  if (board[nodeId] !== null) return;

  board[nodeId] = PLAYER_ONE;
  totalMoves += 1;
  playSound("place");

  if (mode === "puzzle") {
    completePuzzle(activePuzzle && nodeId === activePuzzle.solution && Boolean(findWinner(PLAYER_ONE)));
    renderBoard();
    return;
  }

  if (finishLocalTurn(PLAYER_ONE)) return;

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
    totalMoves += 1;
    playSound("move");

    if (mode === "puzzle") {
      completePuzzle(activePuzzle && nodeId === activePuzzle.solution && Boolean(findWinner(PLAYER_ONE)));
      renderBoard();
      return;
    }

    if (finishLocalTurn(PLAYER_ONE)) return;

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
    message.textContent = player === PLAYER_ONE ? `${playerName} wins!` : "PC wins!";

    if (mode === "pc") recordMatch(player === PLAYER_ONE ? "win" : "loss", "pc", "PC");
    if (mode === "tournament") handleTournamentResult(player);

    playSound("win");
    stopTimer();
    showFireworks();
    rematchBtn.classList.remove("hidden");
    renderBoard();
    return true;
  }

  if (isMovementPhase()) {
    phase = "moving";
    const opponent = otherPlayer(player);

    if (getMovableStones(opponent).length === 0) {
      winner = player;
      message.textContent = player === PLAYER_ONE ? `${playerName} wins! PC cannot move.` : "PC wins! You cannot move.";

      if (mode === "pc") recordMatch(player === PLAYER_ONE ? "win" : "loss", "pc", "PC");
      if (mode === "tournament") handleTournamentResult(player);

      playSound("win");
      stopTimer();
      showFireworks();
      rematchBtn.classList.remove("hidden");
      renderBoard();
      return true;
    }
  }

  return false;
}

function handlePcTurn() {
  if (winner) return;

  if (isMovementPhase()) {
    const move = choosePcMovement();

    if (!move) {
      winner = PLAYER_ONE;
      message.textContent = `${playerName} wins! PC cannot move.`;
      if (mode === "pc") recordMatch("win", "pc", "PC");
      if (mode === "tournament") handleTournamentResult(PLAYER_ONE);
      stopTimer();
      showFireworks();
      renderBoard();
      return;
    }

    board[move.from] = null;
    board[move.to] = PLAYER_TWO;
    playSound("move");
  } else {
    const nodeId = choosePcPlacement();
    board[nodeId] = PLAYER_TWO;
    playSound("place");
  }

  totalMoves += 1;

  if (finishLocalTurn(PLAYER_TWO)) return;

  currentTurn = PLAYER_ONE;
  message.textContent = isMovementPhase() ? "Move phase. Select one stone." : "Your turn.";
  renderBoard();
}

function choosePcPlacement() {
  const emptyNodes = board.map((owner, index) => owner === null ? index : null).filter((index) => index !== null);

  if (difficulty !== "easy") {
    for (const nodeId of emptyNodes) {
      const testBoard = [...board];
      testBoard[nodeId] = PLAYER_TWO;
      if (findWinner(PLAYER_TWO, testBoard)) return nodeId;
    }
  }

  if (difficulty === "medium" || difficulty === "hard") {
    for (const nodeId of emptyNodes) {
      const testBoard = [...board];
      testBoard[nodeId] = PLAYER_ONE;
      if (findWinner(PLAYER_ONE, testBoard)) return nodeId;
    }
  }

  if (difficulty === "hard" && board[4] === null) return 4;

  const corners = [0, 2, 6, 8].filter((nodeId) => board[nodeId] === null);
  if (difficulty === "hard" && corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

  return emptyNodes[Math.floor(Math.random() * emptyNodes.length)];
}

function choosePcMovement() {
  const possibleMoves = [];

  for (const from of getMovableStones(PLAYER_TWO)) {
    for (const to of getEmptyNeighbors(from)) {
      possibleMoves.push({ from, to });
    }
  }

  if (difficulty !== "easy") {
    for (const move of possibleMoves) {
      const testBoard = [...board];
      testBoard[move.from] = null;
      testBoard[move.to] = PLAYER_TWO;
      if (findWinner(PLAYER_TWO, testBoard)) return move;
    }
  }

  return possibleMoves[Math.floor(Math.random() * possibleMoves.length)] || null;
}

function resetLocalBoardOnly() {
  board = Array(9).fill(null);
  currentTurn = PLAYER_ONE;
  phase = "placing";
  winner = null;
  winLine = [];
  selectedNode = null;
  availableMoves = [];
  totalMoves = 0;
  onlineInfo.classList.add("hidden");
  rematchBtn.textContent = "Rematch";
  rematchBtn.classList.add("hidden");
  message.textContent = "Your turn.";
  startTimer();
  renderBoard();
}

function resetLocalGame() {
  mode = "pc";
  bodySetMode("normal");
  myOnlinePlayer = null;
  currentRoomId = null;
  gameModeText.textContent = "Play vs PC";
  playerTwoLabel.textContent = "PC";
  resetLocalBoardOnly();
}

function applyOnlineState(state) {
  board = state.board;
  currentTurn = state.currentTurn;
  phase = state.phase;
  winner = state.winner;
  winLine = state.winLine || [];
  totalMoves = typeof state.moveCount === "number" ? state.moveCount : board.filter(Boolean).length;

  if (state.playerCount < 2) {
    rematchBtn.classList.add("hidden");
    message.textContent = "Waiting for another player to join.";
    renderBoard();
    return;
  }

  if (winner) {
    const gameKey = `${currentRoomId}-${winner}-${totalMoves}`;
    message.textContent = winner === myOnlinePlayer ? `${playerName} wins!` : "Opponent wins.";

    if (mode !== "pc" && lastRecordedGameKey !== gameKey) {
      lastRecordedGameKey = gameKey;
      recordMatch(winner === myOnlinePlayer ? "win" : "loss", "online", "Friend");
    }

    stopTimer();
    showFireworks();
    rematchBtn.classList.remove("hidden");
    rematchBtn.disabled = false;
    renderBoard();
    return;
  }

  rematchBtn.classList.add("hidden");
  rematchBtn.disabled = false;
  message.textContent = currentTurn === myOnlinePlayer
    ? phase === "moving" ? "Your turn. Move one stone." : "Your turn. Place one stone."
    : "Waiting for opponent move.";
  renderBoard();
}


function getTournamentNames() {
  const size = Number(tournamentSizeSelect.value);
  const names = tournamentNamesInput.value.split("\n").map((name) => name.trim()).filter(Boolean);
  while (names.length < size) names.push(`Player ${names.length + 1}`);
  return names.slice(0, size);
}

function startTournament() {
  const players = getTournamentNames();
  tournament = { round: 1, players, matches: [], currentMatchIndex: 0, champion: null };
  buildTournamentRound();
  tournamentBracket.classList.remove("hidden");
  renderTournamentBracket();
}

function buildTournamentRound() {
  tournament.matches = [];
  tournament.currentMatchIndex = 0;

  for (let i = 0; i < tournament.players.length; i += 2) {
    tournament.matches.push({ player: tournament.players[i], opponent: tournament.players[i + 1] || "BYE", winner: null });
  }
}

function renderTournamentBracket() {
  tournamentRoundTitle.textContent = tournament.champion ? "Champion" : `Round ${tournament.round}`;
  bracketList.innerHTML = "";

  if (tournament.champion) {
    tournamentStatus.textContent = `${tournament.champion} is the tournament champion!`;
    playTournamentMatchBtn.disabled = true;
    return;
  }

  tournament.matches.forEach((match) => {
    const row = document.createElement("div");
    row.className = "bracket-match";
    if (match.winner) row.classList.add("bracket-winner");
    row.innerHTML = `<span>${match.player}</span><span class="bracket-vs">vs</span><span>${match.opponent}${match.winner ? ` → Winner: ${match.winner}` : ""}</span>`;
    bracketList.appendChild(row);
  });

  const next = tournament.matches[tournament.currentMatchIndex];
  tournamentStatus.textContent = next ? `Next match: ${next.player} vs ${next.opponent}` : "Round complete.";
  playTournamentMatchBtn.disabled = false;
}

function playNextTournamentMatch() {
  if (!tournament || tournament.champion) return;
  const match = tournament.matches[tournament.currentMatchIndex];
  if (!match) return finishTournamentRound();

  if (match.opponent === "BYE") {
    match.winner = match.player;
    tournament.currentMatchIndex += 1;
    renderTournamentBracket();
    return;
  }

  mode = "tournament";
  bodySetMode("tournament");
  playerName = match.player;
  resetLocalBoardOnly();
  gameModeText.textContent = `Tournament: ${match.player} vs ${match.opponent}`;
  showScreen("gameScreen");
}

function handleTournamentResult(winningPlayer) {
  if (!tournament || mode !== "tournament") return;
  const match = tournament.matches[tournament.currentMatchIndex];
  if (!match) return;

  match.winner = winningPlayer === PLAYER_ONE ? match.player : match.opponent;
  tournament.currentMatchIndex += 1;
  renderTournamentBracket();

  if (tournament.currentMatchIndex >= tournament.matches.length) finishTournamentRound();
}

function finishTournamentRound() {
  const winners = tournament.matches.map((match) => match.winner).filter(Boolean);

  if (winners.length <= 1) {
    tournament.champion = winners[0] || "No winner";
    renderTournamentBracket();
    showScreen("tournamentScreen");
    showFireworks();
    return;
  }

  tournament.players = winners;
  tournament.round += 1;
  buildTournamentRound();
  renderTournamentBracket();
  showScreen("tournamentScreen");
}

$("continueBtn").addEventListener("click", () => {
  playerName = playerNameInput.value.trim() || "Player";
  difficulty = difficultySelect.value;
  soundEnabled = soundToggle.checked;
  showScreen("homeScreen");
});

$("playPcBtn").addEventListener("click", () => {
  difficulty = difficultySelect.value;
  resetLocalGame();
  showScreen("gameScreen");
});

$("playOnlineBtn").addEventListener("click", () => showScreen("onlineMenuScreen"));
$("dailyPuzzleBtn").addEventListener("click", () => { updatePuzzleScreen(); showScreen("dailyPuzzleScreen"); });
$("startDailyPuzzleBtn").addEventListener("click", () => { currentPuzzleIndex = getTodayPuzzleIndex(); startPuzzle(currentPuzzleIndex, false); });
$("nextPracticePuzzleBtn").addEventListener("click", () => { currentPuzzleIndex = (currentPuzzleIndex + 1) % puzzleBank.length; startPuzzle(currentPuzzleIndex, true); });
$("tournamentBtn").addEventListener("click", () => { tournamentNamesInput.value = `${playerName}\nPlayer 2\nPlayer 3\nPlayer 4`; showScreen("tournamentScreen"); });
$("startTournamentBtn").addEventListener("click", startTournament);
playTournamentMatchBtn.addEventListener("click", playNextTournamentMatch);
$("statsBtn").addEventListener("click", () => { updateStatsUI(); showScreen("statsScreen"); });
$("resetStatsBtn").addEventListener("click", resetStats);
$("customizeBtn").addEventListener("click", () => showScreen("customizeScreen"));
themeSelect.addEventListener("change", () => applyCustomization(themeSelect.value, pieceSelect.value));
pieceSelect.addEventListener("change", () => applyCustomization(themeSelect.value, pieceSelect.value));
$("saveThemeBtn").addEventListener("click", saveCustomization);
$("resetThemeBtn").addEventListener("click", () => { applyCustomization("classic", "dots"); saveCustomization(); });
$("friendModeBtn").addEventListener("click", () => showScreen("friendScreen"));
$("randomModeBtn").addEventListener("click", () => { mode = "random"; startTimer(); randomStatus.textContent = "Searching for an online player..."; showScreen("randomScreen"); socket.emit("random-match"); });
$("createRoomBtn").addEventListener("click", () => { mode = "online"; startTimer(); friendStatus.textContent = "Creating room..."; socket.emit("create-room"); });
$("joinRoomBtn").addEventListener("click", () => { const roomCode = $("joinCodeInput").value.trim().toUpperCase(); if (roomCode) { mode = "online"; startTimer(); socket.emit("join-room", roomCode); } });
$("copyCodeBtn").addEventListener("click", async () => { if (currentRoomId) await navigator.clipboard.writeText(currentRoomId); });
$("copyLinkBtn").addEventListener("click", async () => { if (roomLinkInput.value) await navigator.clipboard.writeText(roomLinkInput.value); });
$("newGameBtn").addEventListener("click", () => { if (mode === "pc") resetLocalGame(); else if (mode === "puzzle") startPuzzle(activePuzzle ? activePuzzle.index : currentPuzzleIndex, activePuzzle ? activePuzzle.isPractice : true); });
rematchBtn.addEventListener("click", () => { if (mode === "pc") resetLocalGame(); else if (mode === "puzzle") startPuzzle(activePuzzle ? activePuzzle.index : currentPuzzleIndex, activePuzzle ? activePuzzle.isPractice : true); else if (mode === "tournament") showScreen("tournamentScreen"); else { socket.emit("request-rematch"); message.textContent = "Rematch requested. Waiting for opponent..."; rematchBtn.disabled = true; } });
$("exitGameBtn").addEventListener("click", () => { stopTimer(); bodySetMode("normal"); showScreen("homeScreen"); });
document.querySelectorAll(".back-btn[data-screen]").forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.screen)));

socket.on("joined-room", ({ roomId, player, state }) => {
  myOnlinePlayer = player;
  currentRoomId = roomId;
  const roomLink = `${window.location.origin}/room/${roomId}`;
  createdRoomBox.classList.remove("hidden");
  roomCodeDisplay.textContent = roomId;
  roomLinkInput.value = roomLink;
  onlineRoomBadge.textContent = `Room: ${roomId}`;
  onlineInfo.classList.remove("hidden");
  connectionBadge.textContent = "🟢 Connected";
  gameModeText.textContent = mode === "random" ? "Random Opponent" : "Play with Friend";
  window.history.replaceState({}, "", `/room/${roomId}`);
  showScreen("gameScreen");
  applyOnlineState(state);
});

socket.on("room-state", (state) => { if (myOnlinePlayer) applyOnlineState(state); });
socket.on("stone-selected", ({ selectedNode: nodeId, availableMoves: moves }) => { selectedNode = nodeId; availableMoves = moves || []; renderBoard(); });
socket.on("waiting-random", (text) => { randomStatus.textContent = text; });
socket.on("room-error", (text) => { friendStatus.textContent = text; message.textContent = text; playSound("error"); });
socket.on("rematch-status", ({ votes, needed }) => { const hasMyVote = votes.includes(myOnlinePlayer); message.textContent = hasMyVote ? `Rematch requested. Waiting for opponent (${votes.length}/${needed}).` : "Opponent wants a rematch. Click Rematch to accept."; rematchBtn.classList.remove("hidden"); rematchBtn.disabled = hasMyVote; });
socket.on("rematch-started", (state) => { selectedNode = null; availableMoves = []; winner = null; winLine = []; totalMoves = 0; lastRecordedGameKey = null; rematchBtn.disabled = false; rematchBtn.classList.add("hidden"); startTimer(); applyOnlineState(state); });
socket.on("opponent-left", (text) => { connectionBadge.textContent = "🔴 Disconnected"; message.textContent = text; });

const savedCustomization = loadCustomization();
applyCustomization(savedCustomization.theme, savedCustomization.pieces);
updateStatsUI();
updateTimerDisplay();

const roomMatch = window.location.pathname.match(/^\/room\/([A-Z0-9]+)$/i);
if (roomMatch) { mode = "online"; startTimer(); socket.emit("join-room", roomMatch[1]); }
