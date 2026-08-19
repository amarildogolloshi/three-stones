const socket = io();

const PLAYER_ONE = "player1";
const PLAYER_TWO = "player2";
const MAX_STONES = 3;
const $ = (id) => document.getElementById(id);

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

const dom = {
  screens: document.querySelectorAll(".screen"),
  boardNodes: $("boardNodes"),
  message: $("message"),
  turnBox: $("turnBox"),
  playerOneCount: $("playerOneCount"),
  playerTwoCount: $("playerTwoCount"),
  playerOneLabel: $("playerOneLabel"),
  playerTwoLabel: $("playerTwoLabel"),
  gameModeText: $("gameModeText"),
  onlineInfo: $("onlineInfo"),
  onlineRoomBadge: $("onlineRoomBadge"),
  connectionBadge: $("connectionBadge"),
  createdRoomBox: $("createdRoomBox"),
  roomCodeDisplay: $("roomCodeDisplay"),
  roomLinkInput: $("roomLinkInput"),
  friendStatus: $("friendStatus"),
  randomStatus: $("randomStatus"),
  playerNameInput: $("playerNameInput"),
  difficultySelect: $("difficultySelect"),
  soundToggle: $("soundToggle"),
  moveCounter: $("moveCounter"),
  timerDisplay: $("timerDisplay"),
  difficultyDisplay: $("difficultyDisplay"),
  rematchBtn: $("rematchBtn"),
  fireworks: $("fireworks"),
  rankTitle: $("rankTitle"),
  rankPoints: $("rankPoints"),
  statGames: $("statGames"),
  statWins: $("statWins"),
  statWinRate: $("statWinRate"),
  detailRankTitle: $("detailRankTitle"),
  detailRankPoints: $("detailRankPoints"),
  detailGames: $("detailGames"),
  detailWins: $("detailWins"),
  detailLosses: $("detailLosses"),
  detailWinRate: $("detailWinRate"),
  detailBestTime: $("detailBestTime"),
  detailFewestMoves: $("detailFewestMoves"),
  matchHistoryList: $("matchHistoryList"),
  themeSelect: $("themeSelect"),
  pieceSelect: $("pieceSelect"),
  dailyPuzzleSubtitle: $("dailyPuzzleSubtitle"),
  challengeBadge: $("challengeBadge"),
  puzzleInstruction: $("puzzleInstruction"),
  puzzleStatus: $("puzzleStatus"),
  tournamentSizeSelect: $("tournamentSizeSelect"),
  tournamentNamesInput: $("tournamentNamesInput"),
  tournamentBracket: $("tournamentBracket"),
  tournamentRoundTitle: $("tournamentRoundTitle"),
  bracketList: $("bracketList"),
  tournamentStatus: $("tournamentStatus"),
  playTournamentMatchBtn: $("playTournamentMatchBtn"),
  coachPanel: $("coachPanel"),
  coachSummary: $("coachSummary"),
  coachList: $("coachList"),
  installBtn: $("installBtn")
};

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
let currentTheme = "classic";
let currentPieces = "dots";
let activePuzzle = null;
let currentPuzzleIndex = 0;
let tournament = null;
let deferredInstallPrompt = null;

function showScreen(screenId) {
  dom.screens.forEach((screen) => screen.classList.remove("active"));
  $(screenId).classList.add("active");
}

function setModeClass(name) {
  document.body.classList.remove("puzzle-active", "tournament-active");
  if (name === "puzzle") document.body.classList.add("puzzle-active");
  if (name === "tournament") document.body.classList.add("tournament-active");
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
  dom.timerDisplay.textContent = formatTime(elapsedSeconds);
}

function playSound(type) {
  if (!soundEnabled) return;
  if (!audioContext) audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  const frequency = { place: 350, move: 520, win: 760, error: 180 }[type] || 350;

  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.type = type === "win" ? "triangle" : "sine";
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.2);
}

function showFireworks() {
  dom.fireworks.classList.remove("hidden");
  dom.fireworks.innerHTML = "";

  for (let i = 0; i < 18; i += 1) {
    const dot = document.createElement("span");
    dot.className = "firework";
    dot.style.left = `${10 + Math.random() * 80}%`;
    dot.style.top = `${10 + Math.random() * 70}%`;
    dot.style.background = ["#facc15", "#22c55e", "#38bdf8", "#fb7185"][i % 4];
    dom.fireworks.appendChild(dot);
  }

  setTimeout(() => {
    dom.fireworks.classList.add("hidden");
    dom.fireworks.innerHTML = "";
  }, 1200);
}

function hideCoach() {
  dom.coachPanel.classList.add("hidden");
  dom.coachList.innerHTML = "";
}

function showCoach(winningPlayer) {
  const notes = [];

  if (mode === "puzzle") {
    notes.push("Puzzle tip: find the line with two stones, then complete the third spot.");
  } else if (mode === "tournament") {
    notes.push("Tournament tip: block immediate threats before attacking.");
  } else if (mode === "online" || mode === "random") {
    notes.push("Online tip: watch for two-in-a-row threats and block early.");
  } else {
    notes.push("PC tip: center control gives the most movement options.");
  }

  if (winLine.length > 0) {
    notes.push(`Winning line: nodes ${winLine.map((nodeId) => nodeId + 1).join("-")}.`);
  }

  notes.push(totalMoves <= 6 ? "This was a quick game. Opening placement mattered most." : "In longer games, keep one stone near the center.");

  dom.coachSummary.textContent = winningPlayer === PLAYER_ONE || winningPlayer === myOnlinePlayer
    ? "Coach review: you won."
    : "Coach review: review the final threat and block earlier.";
  dom.coachList.innerHTML = "";

  notes.forEach((note) => {
    const li = document.createElement("li");
    li.textContent = note;
    dom.coachList.appendChild(li);
  });

  dom.coachPanel.classList.remove("hidden");
}

function loadStats() {
  return JSON.parse(localStorage.getItem("threeStonesStatsV27") || "null") || {
    rating: 1000,
    games: 0,
    wins: 0,
    losses: 0,
    bestTime: null,
    fewestMoves: null,
    history: []
  };
}

function saveStats(stats) {
  localStorage.setItem("threeStonesStatsV27", JSON.stringify(stats));
}

function getRankName(rating) {
  if (rating >= 1800) return "Diamond";
  if (rating >= 1600) return "Platinum";
  if (rating >= 1400) return "Gold";
  if (rating >= 1200) return "Silver";
  return "Bronze";
}

function recordMatch(result, gameMode, opponentName) {
  const stats = loadStats();
  const ratingChange = result === "win" ? (gameMode === "online" ? 26 : 18) : (gameMode === "online" ? -26 : -18);

  stats.games += 1;
  if (result === "win") stats.wins += 1;
  if (result === "loss") stats.losses += 1;
  stats.rating = Math.max(100, stats.rating + ratingChange);

  if (result === "win") {
    if (stats.bestTime === null || elapsedSeconds < stats.bestTime) stats.bestTime = elapsedSeconds;
    if (stats.fewestMoves === null || totalMoves < stats.fewestMoves) stats.fewestMoves = totalMoves;
  }

  stats.history.unshift({
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

  dom.rankTitle.textContent = rank;
  dom.rankPoints.textContent = `${stats.rating} RP`;
  dom.statGames.textContent = stats.games;
  dom.statWins.textContent = stats.wins;
  dom.statWinRate.textContent = `${winRate}%`;
  dom.detailRankTitle.textContent = rank;
  dom.detailRankPoints.textContent = stats.rating;
  dom.detailGames.textContent = stats.games;
  dom.detailWins.textContent = stats.wins;
  dom.detailLosses.textContent = stats.losses;
  dom.detailWinRate.textContent = `${winRate}%`;
  dom.detailBestTime.textContent = stats.bestTime === null ? "--:--" : formatTime(stats.bestTime);
  dom.detailFewestMoves.textContent = stats.fewestMoves === null ? "--" : stats.fewestMoves;
  dom.matchHistoryList.innerHTML = "";

  if (stats.history.length === 0) {
    dom.matchHistoryList.innerHTML = '<p class="history-meta">No matches yet.</p>';
    return;
  }

  stats.history.forEach((match) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const resultLabel = match.result === "win" ? "W" : "L";
    const rp = match.ratingChange > 0 ? `+${match.ratingChange}` : match.ratingChange;
    item.innerHTML = `<div class="history-result ${match.result}">${resultLabel}</div><div><strong>${match.mode} vs ${match.opponent}</strong><div class="history-meta">${match.date} • ${match.moves} moves • ${formatTime(match.seconds)}</div></div><div class="history-rp">${rp} RP</div>`;
    dom.matchHistoryList.appendChild(item);
  });
}

function resetStats() {
  localStorage.removeItem("threeStonesStatsV27");
  updateStatsUI();
}

function applyCustomization(theme = currentTheme, pieces = currentPieces) {
  document.body.classList.remove("theme-classic", "theme-dark", "theme-wood", "theme-neon", "theme-stone", "theme-space", "pieces-dots", "pieces-stars", "pieces-gems", "pieces-shields", "pieces-animals");
  document.body.classList.add(`theme-${theme}`, `pieces-${pieces}`);
  currentTheme = theme;
  currentPieces = pieces;
  dom.themeSelect.value = theme;
  dom.pieceSelect.value = pieces;
  renderBoard();
}

function loadCustomization() {
  return JSON.parse(localStorage.getItem("threeStonesCustomizeV27") || "null") || { theme: "classic", pieces: "dots" };
}

function saveCustomization() {
  localStorage.setItem("threeStonesCustomizeV27", JSON.stringify({ theme: currentTheme, pieces: currentPieces }));
}

function getPieceSymbol(owner) {
  const set = pieceSets[currentPieces] || pieceSets.dots;
  if (owner === PLAYER_ONE) return set.one;
  if (owner === PLAYER_TWO) return set.two;
  return set.empty;
}

function todayPuzzleIndex() {
  const key = new Date().toISOString().slice(0, 10);
  return [...key].reduce((sum, character) => sum + character.charCodeAt(0), 0) % puzzleBank.length;
}

function loadPuzzleProgress() {
  return JSON.parse(localStorage.getItem("threeStonesPuzzleV27") || "{}");
}

function savePuzzleProgress(progress) {
  localStorage.setItem("threeStonesPuzzleV27", JSON.stringify(progress));
}

function updatePuzzleScreen() {
  const index = todayPuzzleIndex();
  const puzzle = puzzleBank[index];
  const dateKey = new Date().toISOString().slice(0, 10);
  const progress = loadPuzzleProgress();
  dom.dailyPuzzleSubtitle.textContent = `Today's puzzle: ${dateKey}`;
  dom.challengeBadge.textContent = puzzle.title;
  dom.puzzleInstruction.textContent = puzzle.instruction;
  dom.puzzleStatus.textContent = progress[dateKey] ? "Completed today. You can still practice." : "Puzzle ready.";
}

function startPuzzle(index = todayPuzzleIndex(), isPractice = false) {
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
  setModeClass("puzzle");
  dom.gameModeText.textContent = isPractice ? "Practice Puzzle" : "Daily Puzzle";
  dom.message.textContent = puzzle.instruction;
  dom.rematchBtn.textContent = "Try Again";
  dom.rematchBtn.classList.add("hidden");
  dom.onlineInfo.classList.add("hidden");
  hideCoach();
  startTimer();
  renderBoard();
  showScreen("gameScreen");
}

function completePuzzle(success) {
  stopTimer();
  if (success) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const progress = loadPuzzleProgress();
    if (!activePuzzle.isPractice) {
      progress[dateKey] = true;
      savePuzzleProgress(progress);
    }
    dom.message.textContent = activePuzzle.isPractice ? "Practice puzzle solved!" : "Daily puzzle solved!";
    showFireworks();
    playSound("win");
    showCoach(PLAYER_ONE);
  } else {
    dom.message.textContent = "Not the best move. Click Try Again to reset this puzzle.";
    playSound("error");
    showCoach(PLAYER_TWO);
  }
  dom.rematchBtn.textContent = "Try Again";
  dom.rematchBtn.classList.remove("hidden");
  updatePuzzleScreen();
}

function renderBoard() {
  dom.boardNodes.innerHTML = "";

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
    dom.boardNodes.appendChild(button);
  });

  dom.playerOneCount.textContent = countStones(PLAYER_ONE);
  dom.playerTwoCount.textContent = countStones(PLAYER_TWO);
  dom.playerOneLabel.textContent = mode === "online" || mode === "random" ? (myOnlinePlayer === PLAYER_ONE ? playerName : "Friend") : playerName;
  dom.playerTwoLabel.textContent = mode === "online" || mode === "random" ? (myOnlinePlayer === PLAYER_TWO ? playerName : "Friend") : "PC";
  dom.moveCounter.textContent = totalMoves;
  dom.difficultyDisplay.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);

  if (winner) dom.turnBox.textContent = "Game Over";
  else if (mode === "online" || mode === "random") dom.turnBox.textContent = currentTurn === myOnlinePlayer ? "Your Turn" : "Opponent Turn";
  else dom.turnBox.textContent = currentTurn === PLAYER_ONE ? "Your Turn" : "PC Turn";
}

function canClickNode(nodeId) {
  if (winner) return false;
  if (mode === "online" || mode === "random") return currentTurn === myOnlinePlayer;
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
  if ((mode === "pc" || mode === "tournament") && isMovementPhase() && board[nodeId] === PLAYER_ONE) {
    selectedNode = nodeId;
    availableMoves = getEmptyNeighbors(nodeId);
    renderBoard();
  }
}

function handlePointerRelease(nodeId) {
  if ((mode === "pc" || mode === "tournament") && isMovementPhase() && selectedNode !== null && availableMoves.includes(nodeId)) {
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
  dom.message.textContent = "PC is thinking...";
  renderBoard();
  setTimeout(handlePcTurn, 450);
}

function moveLocalStone(nodeId) {
  if (selectedNode === null) {
    if (board[nodeId] === PLAYER_ONE && getEmptyNeighbors(nodeId).length > 0) {
      selectedNode = nodeId;
      availableMoves = getEmptyNeighbors(nodeId);
      dom.message.textContent = "Choose a green connected node.";
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
    dom.message.textContent = "PC is thinking...";
    renderBoard();
    setTimeout(handlePcTurn, 450);
  }
}

function finishLocalTurn(player) {
  const line = findWinner(player);

  if (line) {
    winner = player;
    winLine = line;
    dom.message.textContent = player === PLAYER_ONE ? `${playerName} wins!` : "PC wins!";

    if (mode === "pc") recordMatch(player === PLAYER_ONE ? "win" : "loss", "pc", "PC");
    if (mode === "tournament") handleTournamentResult(player);

    playSound("win");
    stopTimer();
    showFireworks();
    showCoach(player);
    dom.rematchBtn.classList.remove("hidden");
    renderBoard();
    return true;
  }

  if (isMovementPhase()) {
    phase = "moving";
  }

  return false;
}

function handlePcTurn() {
  if (winner) return;

  if (isMovementPhase()) {
    const move = choosePcMovement();
    if (!move) return;
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
  dom.message.textContent = isMovementPhase() ? "Move phase. Select one stone." : "Your turn.";
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
  dom.onlineInfo.classList.add("hidden");
  dom.rematchBtn.textContent = "Rematch";
  dom.rematchBtn.classList.add("hidden");
  dom.message.textContent = "Your turn.";
  hideCoach();
  startTimer();
  renderBoard();
}

function resetLocalGame() {
  mode = "pc";
  setModeClass("normal");
  myOnlinePlayer = null;
  currentRoomId = null;
  dom.gameModeText.textContent = "Play vs PC";
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
    dom.message.textContent = "Waiting for another player to join.";
    renderBoard();
    return;
  }

  if (winner) {
    dom.message.textContent = winner === myOnlinePlayer ? `${playerName} wins!` : "Opponent wins.";
    recordMatch(winner === myOnlinePlayer ? "win" : "loss", "online", "Friend");
    stopTimer();
    showFireworks();
    showCoach(winner);
    dom.rematchBtn.classList.remove("hidden");
    renderBoard();
    return;
  }

  dom.rematchBtn.classList.add("hidden");
  dom.message.textContent = currentTurn === myOnlinePlayer
    ? phase === "moving" ? "Your turn. Move one stone." : "Your turn. Place one stone."
    : "Waiting for opponent move.";
  renderBoard();
}

function getTournamentNames() {
  const size = Number(dom.tournamentSizeSelect.value);
  const names = dom.tournamentNamesInput.value.split("\n").map((name) => name.trim()).filter(Boolean);
  while (names.length < size) names.push(`Player ${names.length + 1}`);
  return names.slice(0, size);
}

function startTournament() {
  const players = getTournamentNames();
  tournament = { round: 1, players, matches: [], currentMatchIndex: 0, champion: null };
  buildTournamentRound();
  dom.tournamentBracket.classList.remove("hidden");
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
  dom.tournamentRoundTitle.textContent = tournament.champion ? "Champion" : `Round ${tournament.round}`;
  dom.bracketList.innerHTML = "";

  if (tournament.champion) {
    dom.tournamentStatus.textContent = `${tournament.champion} is the tournament champion!`;
    dom.playTournamentMatchBtn.disabled = true;
    return;
  }

  tournament.matches.forEach((match) => {
    const row = document.createElement("div");
    row.className = "bracket-match";
    if (match.winner) row.classList.add("bracket-winner");
    row.innerHTML = `<span>${match.player}</span><span class="bracket-vs">vs</span><span>${match.opponent}${match.winner ? ` → Winner: ${match.winner}` : ""}</span>`;
    dom.bracketList.appendChild(row);
  });

  const next = tournament.matches[tournament.currentMatchIndex];
  dom.tournamentStatus.textContent = next ? `Next match: ${next.player} vs ${next.opponent}` : "Round complete.";
  dom.playTournamentMatchBtn.disabled = false;
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
  setModeClass("tournament");
  playerName = match.player;
  resetLocalBoardOnly();
  dom.gameModeText.textContent = `Tournament: ${match.player} vs ${match.opponent}`;
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

function registerPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dom.installBtn.classList.remove("hidden");
  });
}

function wireEvents() {
  $("continueBtn").addEventListener("click", () => {
    playerName = dom.playerNameInput.value.trim() || "Player";
    difficulty = dom.difficultySelect.value;
    soundEnabled = dom.soundToggle.checked;
    showScreen("homeScreen");
  });

  $("playPcBtn").addEventListener("click", () => {
    difficulty = dom.difficultySelect.value;
    resetLocalGame();
    showScreen("gameScreen");
  });

  $("playOnlineBtn").addEventListener("click", () => showScreen("onlineMenuScreen"));
  $("rulesBtn").addEventListener("click", () => showScreen("rulesScreen"));
  $("dailyPuzzleBtn").addEventListener("click", () => { updatePuzzleScreen(); showScreen("dailyPuzzleScreen"); });
  $("startDailyPuzzleBtn").addEventListener("click", () => { currentPuzzleIndex = todayPuzzleIndex(); startPuzzle(currentPuzzleIndex, false); });
  $("nextPracticePuzzleBtn").addEventListener("click", () => { currentPuzzleIndex = (currentPuzzleIndex + 1) % puzzleBank.length; startPuzzle(currentPuzzleIndex, true); });
  $("tournamentBtn").addEventListener("click", () => { dom.tournamentNamesInput.value = `${playerName}\nPlayer 2\nPlayer 3\nPlayer 4`; showScreen("tournamentScreen"); });
  $("startTournamentBtn").addEventListener("click", startTournament);
  dom.playTournamentMatchBtn.addEventListener("click", playNextTournamentMatch);
  $("statsBtn").addEventListener("click", () => { updateStatsUI(); showScreen("statsScreen"); });
  $("resetStatsBtn").addEventListener("click", resetStats);
  $("customizeBtn").addEventListener("click", () => showScreen("customizeScreen"));
  dom.themeSelect.addEventListener("change", () => applyCustomization(dom.themeSelect.value, dom.pieceSelect.value));
  dom.pieceSelect.addEventListener("change", () => applyCustomization(dom.themeSelect.value, dom.pieceSelect.value));
  $("saveThemeBtn").addEventListener("click", saveCustomization);
  $("resetThemeBtn").addEventListener("click", () => { applyCustomization("classic", "dots"); saveCustomization(); });
  $("friendModeBtn").addEventListener("click", () => showScreen("friendScreen"));
  $("randomModeBtn").addEventListener("click", () => { mode = "random"; startTimer(); dom.randomStatus.textContent = "Searching for an online player..."; showScreen("randomScreen"); socket.emit("random-match"); });
  $("createRoomBtn").addEventListener("click", () => { mode = "online"; startTimer(); socket.emit("create-room"); });
  $("joinRoomBtn").addEventListener("click", () => { const code = $("joinCodeInput").value.trim().toUpperCase(); if (code) { mode = "online"; startTimer(); socket.emit("join-room", code); } });
  $("copyCodeBtn").addEventListener("click", async () => { if (currentRoomId) await navigator.clipboard.writeText(currentRoomId); });
  $("copyLinkBtn").addEventListener("click", async () => { if (dom.roomLinkInput.value) await navigator.clipboard.writeText(dom.roomLinkInput.value); });
  $("newGameBtn").addEventListener("click", () => { if (mode === "pc") resetLocalGame(); else if (mode === "puzzle") startPuzzle(activePuzzle ? activePuzzle.index : currentPuzzleIndex, activePuzzle ? activePuzzle.isPractice : true); });
  dom.rematchBtn.addEventListener("click", () => { if (mode === "pc") resetLocalGame(); else if (mode === "puzzle") startPuzzle(activePuzzle ? activePuzzle.index : currentPuzzleIndex, activePuzzle ? activePuzzle.isPractice : true); else if (mode === "tournament") showScreen("tournamentScreen"); else { socket.emit("request-rematch"); dom.message.textContent = "Rematch requested. Waiting for opponent..."; } });
  $("exitGameBtn").addEventListener("click", () => { stopTimer(); setModeClass("normal"); showScreen("homeScreen"); });

  dom.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    dom.installBtn.classList.add("hidden");
  });

  document.querySelectorAll(".back-btn[data-screen]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
  });
}

function wireSocket() {
  socket.on("joined-room", ({ roomId, player, state }) => {
    myOnlinePlayer = player;
    currentRoomId = roomId;
    selectedNode = null;
    availableMoves = [];
    const roomLink = `${window.location.origin}/room/${roomId}`;
    dom.createdRoomBox.classList.remove("hidden");
    dom.roomCodeDisplay.textContent = roomId;
    dom.roomLinkInput.value = roomLink;
    dom.onlineRoomBadge.textContent = `Room: ${roomId}`;
    dom.onlineInfo.classList.remove("hidden");
    dom.connectionBadge.textContent = "🟢 Connected";
    dom.gameModeText.textContent = mode === "random" ? "Random Opponent" : "Play with Friend";
    window.history.replaceState({}, "", `/room/${roomId}`);
    showScreen("gameScreen");
    applyOnlineState(state);
  });

  socket.on("room-state", (state) => { if (myOnlinePlayer) applyOnlineState(state); });
  socket.on("stone-selected", ({ selectedNode: nodeId, availableMoves: moves }) => { selectedNode = nodeId; availableMoves = moves || []; renderBoard(); });
  socket.on("waiting-random", (text) => { dom.randomStatus.textContent = text; });
  socket.on("room-error", (text) => { dom.friendStatus.textContent = text; dom.message.textContent = text; playSound("error"); });
  socket.on("opponent-left", (text) => { dom.connectionBadge.textContent = "🔴 Disconnected"; dom.message.textContent = text; });
  socket.on("rematch-status", ({ votes, needed }) => { const voted = votes.includes(myOnlinePlayer); dom.message.textContent = voted ? `Rematch requested. Waiting for opponent (${votes.length}/${needed}).` : "Opponent wants a rematch. Click Rematch to accept."; dom.rematchBtn.classList.remove("hidden"); });
  socket.on("rematch-started", (state) => { selectedNode = null; availableMoves = []; winner = null; winLine = []; totalMoves = 0; dom.rematchBtn.classList.add("hidden"); hideCoach(); startTimer(); applyOnlineState(state); });
}

const customization = loadCustomization();
applyCustomization(customization.theme, customization.pieces);
updateStatsUI();
updateTimerDisplay();
wireEvents();
wireSocket();
registerPwa();

const roomMatch = window.location.pathname.match(/^\/room\/([A-Z0-9]+)$/i);
if (roomMatch) {
  mode = "online";
  startTimer();
  socket.emit("join-room", roomMatch[1]);
}
