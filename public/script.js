const ONLINE_AVAILABLE = typeof window.io === "function";
const socket = ONLINE_AVAILABLE
  ? window.io()
  : {
      on() {},
      emit() {
        console.warn("Online mode requires the Node.js server.");
      },
    };
const P1 = "player1";
const P2 = "player2";
const MAX = 3;
const GUEST_NAME_KEY = "threeStonesGuestNameV342";

function generateGuestName() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(
    bytes,
    (value) => alphabet[value % alphabet.length],
  ).join("");
  return `Guest-${suffix}`;
}

function getGuestName() {
  let guestName = localStorage.getItem(GUEST_NAME_KEY);
  if (!guestName || !/^Guest-[A-Z2-9]{6}$/.test(guestName)) {
    guestName = generateGuestName();
    localStorage.setItem(GUEST_NAME_KEY, guestName);
  }
  return guestName;
}
const $ = (id) => document.getElementById(id);
const nodes = [
  { id: 0, x: 15, y: 15 },
  { id: 1, x: 50, y: 15 },
  { id: 2, x: 85, y: 15 },
  { id: 3, x: 15, y: 50 },
  { id: 4, x: 50, y: 50 },
  { id: 5, x: 85, y: 50 },
  { id: 6, x: 15, y: 85 },
  { id: 7, x: 50, y: 85 },
  { id: 8, x: 85, y: 85 },
];
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
const pieces = {
  dots: { one: "●", two: "●", empty: "+" },
  stars: { one: "★", two: "★", empty: "+" },
  gems: { one: "◆", two: "◆", empty: "+" },
  shields: { one: "⬟", two: "⬟", empty: "+" },
  animals: { one: "🐺", two: "🦊", empty: "+" },
};
const puzzles = [
  {
    title: "Win in 1",
    instruction:
      "Place your blue stone on the center node to complete the diagonal.",
    board: [P1, null, P2, null, null, P2, null, null, P1],
    phase: "placing",
    solution: 4,
  },
  {
    title: "Win in 1",
    instruction:
      "Place your blue stone on the middle-right node to complete the center row.",
    board: [P2, null, null, P1, P1, null, null, P2, null],
    phase: "placing",
    solution: 5,
  },
  {
    title: "Move to Win",
    instruction:
      "Move the selected blue stone from the center to the top-right node to complete the top row.",
    board: [P1, P1, null, P2, P1, P2, P2, null, null],
    phase: "moving",
    solutionFrom: 4,
    solution: 2,
  },
  {
    title: "Win in 1",
    instruction:
      "Place your blue stone on the bottom-middle node to complete the column.",
    board: [P2, P1, null, null, P1, P2, null, null, null],
    phase: "placing",
    solution: 7,
  },

  {
    title: "Win in 1",
    instruction:
      "Place your blue stone on the top-middle node to complete the column.",
    board: [P2, null, P2, null, P1, null, null, P1, null],
    phase: "placing",
    solution: 1,
  },
  {
    title: "Block First",
    instruction:
      "Place your blue stone on the bottom-right node to block PC's diagonal threat.",
    board: [P2, P1, null, null, P2, P1, null, null, null],
    phase: "placing",
    solution: 8,
  },
  {
    title: "Move to Win",
    instruction:
      "Move the selected blue stone to the bottom-left node to complete the diagonal.",
    board: [P2, P2, P1, null, P1, P2, null, P1, null],
    phase: "moving",
    solutionFrom: 7,
    solution: 6,
  },
  {
    title: "Center Control",
    instruction:
      "Place your blue stone on the center node to create the strongest position.",
    board: [P1, null, P2, null, null, null, P2, null, P1],
    phase: "placing",
    solution: 4,
  },
];

const PUZZLE_PACKS = [
  {
    id: "beginner",
    icon: "🟢",
    title: "Beginner Pack",
    desc: "Simple win-in-one puzzles.",
    puzzles: [0, 1],
    reward: 30,
  },
  {
    id: "intermediate",
    icon: "🟡",
    title: "Intermediate Pack",
    desc: "Blocks and setup moves.",
    puzzles: [3, 4, 5],
    reward: 50,
  },
  {
    id: "expert",
    icon: "🔴",
    title: "Expert Pack",
    desc: "Movement puzzles and tactical wins.",
    puzzles: [2, 6],
    reward: 75,
  },
  {
    id: "master",
    icon: "👑",
    title: "Master Pack",
    desc: "Mixed puzzles for strong players.",
    puzzles: [0, 2, 5, 6, 7],
    reward: 100,
  },
];

let activePuzzlePack = null;
let activePuzzlePackPosition = 0;
let puzzleSolved = false;
let mode = "pc",
  playerName = getGuestName(),
  difficulty = "medium",
  soundOn = localStorage.getItem("soundOnV330") !== "false",
  onlinePlayer = null,
  roomId = null;
let board = Array(9).fill(null),
  turn = P1,
  phase = "placing",
  gameWinner = null,
  winLine = [],
  selected = null,
  available = [],
  moves = 0;
let elapsed = 0,
  timer = null,
  audio = null,
  theme = "classic",
  pieceSet = "dots",
  activePuzzle = null,
  puzzleIndex = 0,
  tournament = null,
  deferredInstall = null,
  hintNode = null;
const d = {};
[
  "playPcBtn",
  "difficultyModal",
  "closeDifficultyModalBtn",
  "startPcGameBtn",
  "playOnlineBtn",
  "dailyPuzzleBtn",
  "tournamentBtn",
  "statsBtn",
  "rulesBtn",
  "customizeBtn",
  "friendModeBtn",
  "randomModeBtn",
  "createRoomBtn",
  "joinRoomBtn",
  "joinCodeInput",
  "copyCodeBtn",
  "copyLinkBtn",
  "newGameBtn",
  "exitGameBtn",
  "startDailyPuzzleBtn",
  "nextPracticePuzzleBtn",
  "startTournamentBtn",
  "saveThemeBtn",
  "resetThemeBtn",
  "resetStatsBtn",
  "boardNodes",
  "message",
  "turnBox",
  "playerOneCount",
  "playerTwoCount",
  "playerOneLabel",
  "playerTwoLabel",
  "gameModeText",
  "onlineInfo",
  "onlineRoomBadge",
  "connectionBadge",
  "createdRoomBox",
  "roomCodeDisplay",
  "roomLinkInput",
  "friendStatus",
  "randomStatus",
  "difficultySelect",
  "soundToggle",
  "moveCounter",
  "timerDisplay",
  "difficultyDisplay",
  "rematchBtn",
  "fireworks",
  "rankTitle",
  "rankPoints",
  "statGames",
  "statWins",
  "statWinRate",
  "detailRankTitle",
  "detailRankPoints",
  "detailGames",
  "detailWins",
  "detailLosses",
  "detailWinRate",
  "detailBestTime",
  "detailFewestMoves",
  "matchHistoryList",
  "themeSelect",
  "pieceSelect",
  "dailyPuzzleSubtitle",
  "challengeBadge",
  "puzzleInstruction",
  "puzzleStatus",
  "tournamentSizeSelect",
  "tournamentNamesInput",
  "tournamentBracket",
  "tournamentRoundTitle",
  "bracketList",
  "tournamentStatus",
  "playTournamentMatchBtn",
  "coachPanel",
  "coachSummary",
  "coachList",
  "installBtn",
  "accountBadge",
  "loginBtn",
  "registerBtn",
  "profileBtn",
  "leaderboardBtn",
  "achievementsBtn",
  "rewardsBtn",
  "coinsBadge",
  "achievementsList",
  "rewardsCoinsValue",
  "claimDailyRewardBtn",
  "dailyRewardStatus",
  "rewardThemeList",
  "logoutBtn",
  "registerUsernameInput",
  "registerPasswordInput",
  "avatarSelect",
  "createAccountBtn",
  "registerStatus",
  "loginUsernameInput",
  "loginPasswordInput",
  "loginAccountBtn",
  "loginStatus",
  "profileAvatar",
  "profileUsername",
  "profileRank",
  "profileGames",
  "profileWins",
  "profileLosses",
  "profileWinRate",
  "profileBestTime",
  "profileFewestMoves",
  "leaderboardList",
  "accessibilityBtn",
  "largeNodesToggle",
  "highContrastToggle",
  "nodeNumbersToggle",
  "saveAccessibilityBtn",
  "resetAccessibilityBtn",
  "tutorialBtn",
  "puzzlePacksBtn",
  "puzzlePackList",
  "puzzlePackStatus",
  "startTutorialBtn",
  "hintBtn",
].forEach((id) => (d[id] = $(id)));
let currentAccountId =
  localStorage.getItem("threeStonesCurrentAccountV301") || null;
let apiToken = localStorage.getItem("threeStonesApiTokenV340") || null;
let suppressServerSync = false;
let serverSyncTimer = null;

function setText(element, value) {
  if (element) element.textContent = value;
}

function setHtml(element, value) {
  if (element) element.innerHTML = value;
}

function safeOn(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function addBrandingToAllCards() {
  document.querySelectorAll(".screen .card").forEach((card) => {
    if (card.querySelector(":scope > .brand-header")) return;

    const brand = document.createElement("div");
    brand.className = "brand-header";
    brand.innerHTML =
      '<div class="logo-dot brand-logo-dot">●</div><h1>Three Stones</h1>';

    const existingLogo = card.querySelector(":scope > .logo-dot");
    const existingTitle = card.querySelector(":scope > h1");

    if (existingLogo) existingLogo.remove();
    if (existingTitle) existingTitle.remove();

    card.insertBefore(brand, card.firstChild);
  });
}

function showOnlineRequiredMessage() {
  setText(
    d.friendStatus,
    "Online mode requires the Node.js server. Run npm start and open http://localhost:3000.",
  );
  setText(d.message, "Online mode requires the Node.js server.");
}

function updateStaticSafeUi() {
  if (ONLINE_AVAILABLE) return;
  setText(d.playOnlineBtn, "Play Online (Server Required)");
  if (d.randomModeBtn) d.randomModeBtn.disabled = true;
  if (d.createRoomBtn) d.createRoomBtn.disabled = true;
  if (d.joinRoomBtn) d.joinRoomBtn.disabled = true;
}

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}
function count(p) {
  return board.filter((x) => x === p).length;
}
function isMovePhase() {
  return count(P1) === MAX && count(P2) === MAX;
}
function other(p) {
  return p === P1 ? P2 : P1;
}
function findWin(p, b = board) {
  return wins.find((line) => line.every((i) => b[i] === p)) || null;
}
function emptyNs(i, b = board) {
  return neighbors[i].filter((n) => b[n] === null);
}
function movable(p, b = board) {
  return b
    .map((x, i) => (x === p ? i : null))
    .filter((i) => i !== null && emptyNs(i, b).length);
}
function fmt(t) {
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return `${m}:${s}`;
}
function startClock() {
  stopClock();
  elapsed = 0;
  updateClock();
  timer = setInterval(() => {
    elapsed++;
    updateClock();
  }, 1000);
}
function stopClock() {
  if (timer) clearInterval(timer);
  timer = null;
}
function updateClock() {
  d.timerDisplay.textContent = fmt(elapsed);
}
function rankName(r) {
  if (r >= 1800) return "Diamond";
  if (r >= 1600) return "Platinum";
  if (r >= 1400) return "Gold";
  if (r >= 1200) return "Silver";
  return "Bronze";
}
function symbol(owner) {
  const set = pieces[pieceSet] || pieces.dots;
  return owner === P1 ? set.one : owner === P2 ? set.two : set.empty;
}
function ping(type) {
  if (!soundOn) return;
  if (!audio) audio = new AudioContext();
  const o = audio.createOscillator(),
    g = audio.createGain(),
    now = audio.currentTime;
  o.frequency.setValueAtTime(
    { place: 350, move: 520, win: 760, error: 180 }[type] || 350,
    now,
  );
  g.gain.setValueAtTime(0.1, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  o.connect(g);
  g.connect(audio.destination);
  o.start(now);
  o.stop(now + 0.2);
}
function fire() {
  d.fireworks.classList.remove("hidden");
  d.fireworks.innerHTML = "";
  for (let i = 0; i < 16; i++) {
    const x = document.createElement("span");
    x.className = "firework";
    x.style.left = `${10 + Math.random() * 80}%`;
    x.style.top = `${10 + Math.random() * 70}%`;
    x.style.background = ["#facc15", "#22c55e", "#38bdf8", "#fb7185"][i % 4];
    d.fireworks.appendChild(x);
  }
  setTimeout(() => {
    d.fireworks.classList.add("hidden");
    d.fireworks.innerHTML = "";
  }, 1000);
}
function hideCoach() {
  d.coachPanel.classList.add("hidden");
  d.coachList.innerHTML = "";
}
function coach(winner) {
  const notes = [];
  if (mode === "puzzle")
    notes.push(
      "Puzzle tip: find two stones in a line, then complete the third spot.",
    );
  else if (mode === "online" || mode === "random")
    notes.push("Online tip: watch for two-in-a-row threats and block early.");
  else
    notes.push(
      "PC tip: controlling the center gives the most movement options.",
    );
  if (winLine.length)
    notes.push(`Winning line: nodes ${winLine.map((i) => i + 1).join("-")}.`);
  notes.push(
    moves <= 6
      ? "This was a quick game. Opening placement mattered most."
      : "In longer games, keep one stone near the center.",
  );
  d.coachSummary.textContent =
    winner === P1 || winner === onlinePlayer
      ? "Coach review: you won."
      : "Coach review: review the final threat and block earlier.";
  d.coachList.innerHTML = "";
  notes.forEach((n) => {
    const li = document.createElement("li");
    li.textContent = n;
    d.coachList.appendChild(li);
  });
  d.coachPanel.classList.remove("hidden");
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function storeServerSession(payload) {
  apiToken = payload.token;
  localStorage.setItem("threeStonesApiTokenV340", apiToken);
  if (payload.state) applyServerState(payload.state);
}

function applyServerState(state) {
  if (!state?.user) return;
  suppressServerSync = true;
  try {
    const account = { ...state.user, history: state.stats?.history || [] };
    const list = accounts().filter((item) => item.id !== account.id);
    list.push(account);
    saveAccounts(list);
    currentAccountId = account.id;
    localStorage.setItem("threeStonesCurrentAccountV301", currentAccountId);
    saveStats({
      rating: state.stats?.rating || 1000,
      games: state.stats?.games || 0,
      wins: state.stats?.wins || 0,
      losses: state.stats?.losses || 0,
      bestTime: state.stats?.bestTime ?? null,
      fewestMoves: state.stats?.fewestMoves ?? null,
      history: state.stats?.history || [],
    });
    if (state.rewards) saveRewards(state.rewards);
    if (state.puzzleProgress) savePuzzlePackProgress(state.puzzleProgress);
    playerName = account.username;
    if (d.playerNameInput) d.playerNameInput.value = account.username;
  } finally {
    suppressServerSync = false;
  }
  updateAccountUI();
  updateStatsUI();
  updateRewardBadges();
}

function scheduleServerSync() {
  if (suppressServerSync || !apiToken || !currentAccountId) return;
  clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(async () => {
    try {
      await apiRequest("/api/state", {
        method: "PUT",
        body: JSON.stringify({
          stats: loadStats(),
          rewards: loadRewards(),
          puzzleProgress: loadPuzzlePackProgress(),
        }),
      });
    } catch (error) {
      console.warn("SQLite sync postponed:", error.message);
    }
  }, 250);
}

async function restoreServerSession() {
  if (!apiToken) return;
  try {
    const state = await apiRequest("/api/me");
    applyServerState(state);
  } catch {
    apiToken = null;
    localStorage.removeItem("threeStonesApiTokenV340");
  }
}

function accounts() {
  return JSON.parse(localStorage.getItem("threeStonesAccountsV301") || "[]");
}
function saveAccounts(a) {
  localStorage.setItem("threeStonesAccountsV301", JSON.stringify(a));
}
function currentAccount() {
  return accounts().find((a) => a.id === currentAccountId) || null;
}
function defaultStats() {
  return {
    rating: 1000,
    games: 0,
    wins: 0,
    losses: 0,
    bestTime: null,
    fewestMoves: null,
    history: [],
  };
}

const ACHIEVEMENTS = [
  {
    id: "firstWin",
    icon: "🏆",
    title: "First Victory",
    desc: "Win your first game.",
  },
  { id: "fiveWins", icon: "🥈", title: "Five Wins", desc: "Win 5 games." },
  { id: "tenGames", icon: "🎮", title: "Ten Games", desc: "Play 10 games." },
  {
    id: "firstPuzzle",
    icon: "🧩",
    title: "Puzzle Solver",
    desc: "Solve your first puzzle.",
  },
  {
    id: "threePuzzles",
    icon: "⭐",
    title: "Puzzle Streak",
    desc: "Solve 3 puzzles.",
  },
  {
    id: "coinCollector",
    icon: "💰",
    title: "Coin Collector",
    desc: "Collect 250 coins.",
  },
];

const THEME_REWARDS = [
  { id: "classic", name: "Classic", icon: "●", cost: 0 },
  { id: "dark", name: "Dark", icon: "🌙", cost: 0 },
  { id: "wood", name: "Wood", icon: "🪵", cost: 100 },
  { id: "stone", name: "Stone", icon: "🪨", cost: 150 },
  { id: "neon", name: "Neon", icon: "✨", cost: 250 },
  { id: "space", name: "Space", icon: "🚀", cost: 300 },
];

function rewardKey() {
  return `threeStonesRewardsV31_${currentAccountId || "guest"}`;
}

function defaultRewards() {
  return {
    coins: 0,
    achievements: [],
    unlockedThemes: ["classic", "dark"],
    puzzlesSolved: 0,
    dailyRewardDate: null,
    dailyStreak: 0,
  };
}

function loadRewards() {
  const saved =
    JSON.parse(localStorage.getItem(rewardKey()) || "null") || defaultRewards();
  saved.achievements ||= [];
  saved.unlockedThemes ||= ["classic", "dark"];
  saved.coins ||= 0;
  saved.puzzlesSolved ||= 0;
  saved.dailyStreak ||= 0;
  return saved;
}

function saveRewards(rewards) {
  localStorage.setItem(rewardKey(), JSON.stringify(rewards));
  scheduleServerSync();
}

function isThemeUnlocked(themeId) {
  return loadRewards().unlockedThemes.includes(themeId);
}

function unlockAchievement(id) {
  const rewards = loadRewards();
  if (rewards.achievements.includes(id)) return;
  rewards.achievements.push(id);
  rewards.coins += 25;
  saveRewards(rewards);
  updateRewardBadges();
}

function awardCoins(amount) {
  const rewards = loadRewards();
  rewards.coins += amount;
  saveRewards(rewards);
  evaluateAchievements();
  updateRewardBadges();
}

function evaluateAchievements() {
  const stats = loadStats();
  const rewards = loadRewards();
  if (stats.wins >= 1) unlockAchievement("firstWin");
  if (stats.wins >= 5) unlockAchievement("fiveWins");
  if (stats.games >= 10) unlockAchievement("tenGames");
  if (rewards.puzzlesSolved >= 1) unlockAchievement("firstPuzzle");
  if (rewards.puzzlesSolved >= 3) unlockAchievement("threePuzzles");
  if (rewards.coins >= 250) unlockAchievement("coinCollector");
}

function updateRewardBadges() {
  const rewards = loadRewards();
  setText(d.coinsBadge, `Coins: ${rewards.coins}`);
  setText(d.rewardsCoinsValue, `Coins: ${rewards.coins}`);
  updateThemeOptions();
}

function showAchievements() {
  const rewards = loadRewards();
  updateRewardBadges();
  d.achievementsList.innerHTML = "";
  ACHIEVEMENTS.forEach((achievement) => {
    const unlocked = rewards.achievements.includes(achievement.id);
    const row = document.createElement("div");
    row.className = `achievement-row ${unlocked ? "" : "achievement-locked"}`;
    row.innerHTML = `<div class="achievement-icon">${unlocked ? achievement.icon : "🔒"}</div><div><div class="achievement-title">${achievement.title}</div><div class="achievement-desc">${achievement.desc}</div></div><div class="reward-cost">${unlocked ? "Unlocked" : "Locked"}</div>`;
    d.achievementsList.appendChild(row);
  });
  showScreen("achievementsScreen");
}

function showRewardsStore() {
  updateRewardBadges();
  renderRewardsStore();
  showScreen("rewardsScreen");
}

function renderRewardsStore() {
  const rewards = loadRewards();
  d.rewardThemeList.innerHTML = "";
  THEME_REWARDS.forEach((themeReward) => {
    const unlocked = rewards.unlockedThemes.includes(themeReward.id);
    const row = document.createElement("div");
    row.className = "reward-row";
    const buttonText = unlocked ? "Owned" : `Unlock`;
    row.innerHTML = `<div class="reward-icon">${themeReward.icon}</div><div><div class="reward-title">${themeReward.name} Theme</div><div class="reward-desc">${unlocked ? "Already unlocked" : `Cost: ${themeReward.cost} coins`}</div></div><button class="secondary-btn" data-theme-unlock="${themeReward.id}" ${unlocked ? "disabled" : ""}>${buttonText}</button>`;
    d.rewardThemeList.appendChild(row);
  });

  d.rewardThemeList
    .querySelectorAll("[data-theme-unlock]")
    .forEach((button) => {
      button.addEventListener("click", () =>
        unlockTheme(button.dataset.themeUnlock),
      );
    });
}

function unlockTheme(themeId) {
  const rewards = loadRewards();
  const item = THEME_REWARDS.find((themeReward) => themeReward.id === themeId);
  if (!item || rewards.unlockedThemes.includes(themeId)) return;

  if (rewards.coins < item.cost) {
    setText(
      d.dailyRewardStatus,
      `You need ${item.cost - rewards.coins} more coins to unlock ${item.name}.`,
    );
    return;
  }

  rewards.coins -= item.cost;
  rewards.unlockedThemes.push(themeId);
  saveRewards(rewards);
  setText(d.dailyRewardStatus, `${item.name} theme unlocked!`);
  updateRewardBadges();
  renderRewardsStore();
}

function claimDailyReward() {
  const rewards = loadRewards();
  const today = new Date().toISOString().slice(0, 10);
  if (rewards.dailyRewardDate === today) {
    setText(d.dailyRewardStatus, "Daily reward already claimed today.");
    return;
  }

  rewards.dailyRewardDate = today;
  rewards.dailyStreak += 1;
  const bonus = rewards.dailyStreak % 7 === 0 ? 100 : 25;
  rewards.coins += bonus;
  saveRewards(rewards);
  setText(
    d.dailyRewardStatus,
    `Claimed ${bonus} coins! Daily streak: ${rewards.dailyStreak}.`,
  );
  evaluateAchievements();
  updateRewardBadges();
  renderRewardsStore();
}

function addPuzzleReward() {
  const rewards = loadRewards();
  rewards.puzzlesSolved += 1;
  rewards.coins += activePuzzle?.isPractice ? 10 : 25;
  saveRewards(rewards);
  evaluateAchievements();
  updateRewardBadges();
}

function updateThemeOptions() {
  if (!d.themeSelect) return;
  const rewards = loadRewards();
  Array.from(d.themeSelect.options).forEach((option) => {
    const item = THEME_REWARDS.find(
      (themeReward) => themeReward.id === option.value,
    );
    if (!item) return;
    const unlocked = rewards.unlockedThemes.includes(item.id);
    option.disabled = !unlocked;
    option.textContent =
      unlocked || item.cost === 0 ? item.name : `${item.name} 🔒 ${item.cost}`;
  });
}

function loadStats() {
  return (
    JSON.parse(localStorage.getItem("threeStonesStatsV301") || "null") ||
    defaultStats()
  );
}
function saveStats(s) {
  localStorage.setItem("threeStonesStatsV301", JSON.stringify(s));
  scheduleServerSync();
}
function syncAccount() {
  const acc = currentAccount();
  if (!acc) return;
  const s = loadStats(),
    a = accounts(),
    i = a.findIndex((x) => x.id === acc.id);
  if (i < 0) return;
  a[i] = { ...a[i], ...s };
  saveAccounts(a);
  updateAccountUI();
}
function loadAccountStats(acc) {
  saveStats({
    rating: acc.rating || 1000,
    games: acc.games || 0,
    wins: acc.wins || 0,
    losses: acc.losses || 0,
    bestTime: acc.bestTime ?? null,
    fewestMoves: acc.fewestMoves ?? null,
    history: acc.history || [],
  });
  updateStatsUI();
}
async function createAccount() {
  const username = d.registerUsernameInput.value.trim();
  const password = d.registerPasswordInput.value.trim();
  const avatar = d.avatarSelect.value;
  setText(d.registerStatus, "Creating account...");
  try {
    const payload = await apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password, avatar }),
    });
    storeServerSession(payload);
    setText(d.registerStatus, "Account created and saved to SQLite.");
    showScreen("homeScreen");
  } catch (error) {
    setText(d.registerStatus, error.message);
  }
}

async function loginAccount() {
  const username = d.loginUsernameInput.value.trim();
  const password = d.loginPasswordInput.value.trim();
  setText(d.loginStatus, "Signing in...");
  try {
    const payload = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    storeServerSession(payload);
    setText(d.loginStatus, "Signed in.");
    showScreen("homeScreen");
  } catch (error) {
    setText(d.loginStatus, error.message);
  }
}

async function logoutAccount() {
  try {
    if (apiToken) await apiRequest("/api/logout", { method: "POST" });
  } catch (error) {
    console.warn("Server logout failed:", error.message);
  }
  apiToken = null;
  currentAccountId = null;
  localStorage.removeItem("threeStonesApiTokenV340");
  localStorage.removeItem("threeStonesCurrentAccountV301");
  playerName = getGuestName();
  updateAccountUI();
}

function updateAccountUI() {
  const acc = currentAccount();
  if (!acc) {
    d.accountBadge.textContent = `Playing as ${playerName}`;
    d.loginBtn.classList.remove("hidden");
    d.registerBtn.classList.remove("hidden");
    d.profileBtn.classList.add("hidden");
    d.logoutBtn.classList.add("hidden");
    return;
  }
  d.accountBadge.textContent = `${acc.avatar} ${acc.username} • ${rankName(acc.rating || 1000)} • ${acc.rating || 1000} RP`;
  d.loginBtn.classList.add("hidden");
  d.registerBtn.classList.add("hidden");
  d.profileBtn.classList.remove("hidden");
  d.logoutBtn.classList.remove("hidden");
}
function profile() {
  const a = currentAccount();
  if (!a) return;
  const wr = a.games ? Math.round((a.wins / a.games) * 100) : 0;
  d.profileAvatar.textContent = a.avatar;
  d.profileUsername.textContent = a.username;
  d.profileRank.textContent = `${rankName(a.rating || 1000)} • ${a.rating || 1000} RP`;
  d.profileGames.textContent = a.games || 0;
  d.profileWins.textContent = a.wins || 0;
  d.profileLosses.textContent = a.losses || 0;
  d.profileWinRate.textContent = `${wr}%`;
  d.profileBestTime.textContent =
    a.bestTime == null ? "--:--" : fmt(a.bestTime);
  d.profileFewestMoves.textContent =
    a.fewestMoves == null ? "--" : a.fewestMoves;
  showScreen("profileScreen");
}
async function leaderboard() {
  d.leaderboardList.innerHTML =
    '<p class="history-meta">Loading leaderboard...</p>';
  showScreen("leaderboardScreen");
  try {
    const rows = await apiRequest("/api/leaderboard");
    d.leaderboardList.innerHTML = "";
    if (!rows.length) {
      d.leaderboardList.innerHTML =
        '<p class="history-meta">No accounts yet. Register to join the leaderboard.</p>';
      return;
    }
    rows.forEach((account, index) => {
      const wr = account.games
        ? Math.round((account.wins / account.games) * 100)
        : 0;
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      row.innerHTML = `<div class="leaderboard-rank">${index + 1}</div><div><div class="leaderboard-name">${account.avatar} ${account.username}</div><div class="leaderboard-meta">${rankName(account.rating || 1000)} • ${account.wins || 0} wins • ${wr}% win rate</div></div><div class="leaderboard-rating">${account.rating || 1000} RP</div>`;
      d.leaderboardList.appendChild(row);
    });
  } catch (error) {
    d.leaderboardList.innerHTML = `<p class="history-meta">${error.message}</p>`;
  }
}

function record(result, kind, opp) {
  const s = loadStats();
  const change =
    result === "win"
      ? kind === "online"
        ? 26
        : 18
      : kind === "online"
        ? -26
        : -18;
  s.games++;
  if (result === "win") s.wins++;
  else s.losses++;
  s.rating = Math.max(100, s.rating + change);
  if (result === "win") {
    if (s.bestTime == null || elapsed < s.bestTime) s.bestTime = elapsed;
    if (s.fewestMoves == null || moves < s.fewestMoves) s.fewestMoves = moves;
  }
  s.history.unshift({
    result,
    mode: kind,
    opponent: opp,
    moves,
    seconds: elapsed,
    ratingChange: change,
    date: new Date().toLocaleString(),
  });
  s.history = s.history.slice(0, 20);
  saveStats(s);
  updateStatsUI();
  syncAccount();
  awardCoins(result === "win" ? (kind === "online" ? 30 : 20) : 5);
  if (apiToken) {
    apiRequest("/api/matches", {
      method: "POST",
      body: JSON.stringify({
        result,
        mode: kind,
        opponent: opp,
        moves,
        seconds: elapsed,
        ratingChange: change,
      }),
    }).catch((error) =>
      console.warn("Match history sync failed:", error.message),
    );
  }
}
function updateStatsUI() {
  const s = loadStats();
  const wr = s.games ? Math.round((s.wins / s.games) * 100) : 0;

  setText(d.rankTitle, rankName(s.rating));
  setText(d.rankPoints, `${s.rating} RP`);
  setText(d.statGames, s.games);
  setText(d.statWins, s.wins);
  setText(d.statWinRate, `${wr}%`);
  setText(d.detailRankTitle, rankName(s.rating));
  setText(d.detailRankPoints, s.rating);
  setText(d.detailGames, s.games);
  setText(d.detailWins, s.wins);
  setText(d.detailLosses, s.losses);
  setText(d.detailWinRate, `${wr}%`);
  setText(d.detailBestTime, s.bestTime == null ? "--:--" : fmt(s.bestTime));
  setText(d.detailFewestMoves, s.fewestMoves == null ? "--" : s.fewestMoves);

  if (!d.matchHistoryList) return;
  d.matchHistoryList.innerHTML = "";
  if (!s.history.length) {
    d.matchHistoryList.innerHTML =
      '<p class="history-meta">No matches yet.</p>';
    return;
  }

  s.history.forEach((m) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const label = m.result === "win" ? "W" : "L";
    const rp = m.ratingChange > 0 ? `+${m.ratingChange}` : m.ratingChange;
    item.innerHTML = `<div class="history-result ${m.result}">${label}</div><div><strong>${m.mode} vs ${m.opponent}</strong><div class="history-meta">${m.date} • ${m.moves} moves • ${fmt(m.seconds)}</div></div><div class="history-rp">${rp} RP</div>`;
    d.matchHistoryList.appendChild(item);
  });
}

function resetStats() {
  saveStats(defaultStats());
  updateStatsUI();
  syncAccount();
}

function render() {
  d.boardNodes.innerHTML = "";
  nodes.forEach((n) => {
    const b = document.createElement("button"),
      owner = board[n.id];
    b.className = "node";
    b.style.left = `${n.x}%`;
    b.style.top = `${n.y}%`;
    b.textContent = symbol(owner);
    const num = document.createElement("span");
    num.className = "node-number";
    num.textContent = n.id + 1;
    b.appendChild(num);
    if (owner === P1) b.classList.add("player-one");
    if (owner === P2) b.classList.add("player-two");
    if (selected === n.id) b.classList.add("selected");
    if (available.includes(n.id)) b.classList.add("available");
    if (winLine.includes(n.id)) b.classList.add("winning");
    if (hintNode === n.id) b.classList.add("hint-highlight");
    b.disabled = !canClick(n.id);
    b.addEventListener("click", () => clickNode(n.id));
    d.boardNodes.appendChild(b);
  });
  d.playerOneCount.textContent = count(P1);
  d.playerTwoCount.textContent = count(P2);
  d.playerOneLabel.textContent =
    mode === "online" || mode === "random"
      ? onlinePlayer === P1
        ? playerName
        : "Friend"
      : playerName;
  d.playerTwoLabel.textContent =
    mode === "online" || mode === "random"
      ? onlinePlayer === P2
        ? playerName
        : "Friend"
      : "PC";
  d.moveCounter.textContent = moves;
  d.difficultyDisplay.textContent =
    difficulty[0].toUpperCase() + difficulty.slice(1);
  d.turnBox.textContent = gameWinner
    ? "Game Over"
    : mode === "online" || mode === "random"
      ? turn === onlinePlayer
        ? "Your Turn"
        : "Opponent Turn"
      : turn === P1
        ? "Your Turn"
        : "PC Turn";
}
function canClick(i) {
  if (gameWinner) return false;
  if (mode === "online" || mode === "random") return turn === onlinePlayer;
  if (turn !== P1) return false;
  if (mode === "puzzle") {
    if (phase === "placing") return board[i] === null && count(P1) < MAX;
    if (selected === null) return board[i] === P1 && emptyNs(i).length;
    return i === selected || board[i] === P1 || available.includes(i);
  }
  if (!isMovePhase()) return board[i] === null && count(P1) < MAX;
  if (selected === null) return board[i] === P1 && emptyNs(i).length;
  return i === selected || board[i] === P1 || available.includes(i);
}
function clickNode(i) {
  hintNode = null;
  if (mode === "online" || mode === "random") {
    socket.emit("online-action", { nodeId: i });
    return;
  }
  if (mode === "puzzle") {
    phase === "moving" ? moveStone(i) : placeStone(i);
    return;
  }
  isMovePhase() ? moveStone(i) : placeStone(i);
}
function placeStone(i) {
  if (gameWinner || board[i] !== null || count(P1) >= MAX) return;
  board[i] = P1;
  moves++;
  ping("place");
  if (mode === "puzzle") {
    completePuzzle(isPuzzleMoveCorrect(i));
    render();
    return;
  }
  if (finishLocal(P1)) return;
  turn = P2;
  d.message.textContent = "PC is thinking...";
  render();
  setTimeout(pcTurn, 450);
}
function moveStone(i) {
  if (gameWinner) return;
  if (selected === null) {
    if (board[i] === P1 && emptyNs(i).length) {
      selected = i;
      available = emptyNs(i);
      d.message.textContent = "Choose a green connected node.";
      render();
    }
    return;
  }
  if (i === selected) {
    selected = null;
    available = [];
    render();
    return;
  }
  if (board[i] === P1 && emptyNs(i).length) {
    selected = i;
    available = emptyNs(i);
    render();
    return;
  }
  if (available.includes(i)) {
    board[selected] = null;
    board[i] = P1;
    selected = null;
    available = [];
    moves++;
    ping("move");
    if (mode === "puzzle") {
      completePuzzle(isPuzzleMoveCorrect(i));
      render();
      return;
    }
    if (finishLocal(P1)) return;
    turn = P2;
    d.message.textContent = "PC is thinking...";
    render();
    setTimeout(pcTurn, 450);
  }
}
function finishLocal(p) {
  const line = findWin(p);
  if (line) {
    gameWinner = p;
    winLine = line;
    d.message.textContent = p === P1 ? `${playerName} wins!` : "PC wins!";
    if (mode === "pc" || mode === "tutorial")
      record(p === P1 ? "win" : "loss", "pc", "PC");
    ping("win");
    stopClock();
    fire();
    coach(p);
    d.rematchBtn.classList.remove("hidden");
    render();
    return true;
  }
  if (isMovePhase()) phase = "moving";
  return false;
}
function winPlacement(p) {
  for (const i of board
    .map((x, i) => (x === null ? i : null))
    .filter((x) => x !== null)) {
    const b = [...board];
    b[i] = p;
    if (findWin(p, b)) return i;
  }
  return null;
}
function winMovement(p, b = board) {
  for (const from of movable(p, b))
    for (const to of emptyNs(from, b)) {
      const t = [...b];
      t[from] = null;
      t[to] = p;
      if (findWin(p, t)) return { from, to };
    }
  return null;
}
function pcPlacement() {
  const empty = board
    .map((x, i) => (x === null ? i : null))
    .filter((x) => x !== null);
  if (difficulty !== "easy") {
    const w = winPlacement(P2);
    if (w !== null) return w;
  }
  if (["medium", "hard", "expert"].includes(difficulty)) {
    const block = winPlacement(P1);
    if (block !== null) return block;
  }
  if (["hard", "expert"].includes(difficulty) && board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (difficulty === "expert" && corners.length)
    return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)];
}
function pcMovement() {
  const movesList = [];
  for (const from of movable(P2))
    for (const to of emptyNs(from)) movesList.push({ from, to });
  if (difficulty !== "easy") {
    const w = winMovement(P2);
    if (w) return w;
  }
  if (["medium", "hard", "expert"].includes(difficulty)) {
    const b = winMovement(P1);
    if (b) {
      const m = movesList.find((x) => x.to === b.to);
      if (m) return m;
    }
  }
  if (["hard", "expert"].includes(difficulty)) {
    const c = movesList.find((x) => x.to === 4);
    if (c) return c;
  }
  return movesList[Math.floor(Math.random() * movesList.length)] || null;
}
function pcTurn() {
  if (gameWinner) return;
  if (isMovePhase()) {
    const m = pcMovement();
    if (!m) return;
    board[m.from] = null;
    board[m.to] = P2;
    ping("move");
  } else {
    board[pcPlacement()] = P2;
    ping("place");
  }
  moves++;
  if (finishLocal(P2)) return;
  turn = P1;
  d.message.textContent = isMovePhase()
    ? "Move phase. Select one stone."
    : "Your turn.";
  render();
}
function resetBoard() {
  hintNode = null;
  board = Array(9).fill(null);
  turn = P1;
  phase = "placing";
  gameWinner = null;
  winLine = [];
  selected = null;
  available = [];
  moves = 0;
  d.onlineInfo.classList.add("hidden");
  d.rematchBtn.textContent = "Rematch";
  d.rematchBtn.classList.add("hidden");
  d.message.textContent = "Your turn.";
  hideCoach();
  startClock();
  render();
}
function resetGame() {
  mode = "pc";
  onlinePlayer = null;
  roomId = null;
  d.gameModeText.textContent = "Play vs PC";
  resetBoard();
}
function showHint() {
  if (mode === "online" || mode === "random")
    return (d.message.textContent = "Hints are available in local modes only.");
  if (mode === "puzzle" && activePuzzle) {
    hintNode = activePuzzle.solution;
    d.message.textContent = `Hint: use node ${activePuzzle.solution + 1}.`;
    render();
    return;
  }
  let i = winPlacement(P1);
  if (i !== null) {
    hintNode = i;
    d.message.textContent = `Hint: you can win on node ${i + 1}.`;
    render();
    return;
  }
  i = winPlacement(P2);
  if (i !== null) {
    hintNode = i;
    d.message.textContent = `Hint: block PC on node ${i + 1}.`;
    render();
    return;
  }
  if (board[4] === null) {
    hintNode = 4;
    d.message.textContent = "Hint: take the center node 5.";
    render();
    return;
  }
  d.message.textContent =
    "Hint: keep a stone near the center and watch for two-in-a-row threats.";
}
function puzzleToday() {
  const key = new Date().toISOString().slice(0, 10);
  return [...key].reduce((s, c) => s + c.charCodeAt(0), 0) % puzzles.length;
}
function updatePuzzle() {
  const pz = puzzles[puzzleToday()];
  d.dailyPuzzleSubtitle.textContent = `Today's puzzle: ${new Date().toISOString().slice(0, 10)}`;
  d.challengeBadge.textContent = pz.title;
  d.puzzleInstruction.textContent = pz.instruction;
  d.puzzleStatus.textContent = "Puzzle ready.";
}

function puzzlePackKey() {
  return `threeStonesPuzzlePacksV32_${currentAccountId || "guest"}`;
}

function loadPuzzlePackProgress() {
  return JSON.parse(localStorage.getItem(puzzlePackKey()) || "{}");
}

function savePuzzlePackProgress(progress) {
  localStorage.setItem(puzzlePackKey(), JSON.stringify(progress));
  scheduleServerSync();
}

function showPuzzlePacks() {
  const progress = loadPuzzlePackProgress();
  d.puzzlePackList.innerHTML = "";

  PUZZLE_PACKS.forEach((pack) => {
    const solved = progress[pack.id]?.solved || 0;
    const total = pack.puzzles.length;
    const row = document.createElement("div");
    row.className = "puzzle-pack-row";
    row.innerHTML = `<div class="puzzle-pack-icon">${pack.icon}</div><div><div class="puzzle-pack-title">${pack.title}</div><div class="puzzle-pack-meta">${pack.desc} • Reward: ${pack.reward} coins</div></div><div><div class="puzzle-pack-progress">${solved}/${total}</div><button class="primary-btn" data-pack-id="${pack.id}">Start</button></div>`;
    d.puzzlePackList.appendChild(row);
  });

  d.puzzlePackList.querySelectorAll("[data-pack-id]").forEach((button) => {
    button.addEventListener("click", () =>
      startPuzzlePack(button.dataset.packId),
    );
  });

  showScreen("puzzlePacksScreen");
}

function startPuzzlePack(packId) {
  const pack = PUZZLE_PACKS.find((item) => item.id === packId);
  if (!pack) return;

  const progress = loadPuzzlePackProgress();
  const solved = progress[pack.id]?.solved || 0;
  activePuzzlePack = pack;
  activePuzzlePackPosition = solved >= pack.puzzles.length ? 0 : solved;
  setText(d.puzzlePackStatus, `Starting ${pack.title}.`);
  startPuzzle(pack.puzzles[activePuzzlePackPosition], true);
}

function completePuzzlePackStep() {
  if (!activePuzzlePack) return;

  const progress = loadPuzzlePackProgress();
  const total = activePuzzlePack.puzzles.length;
  const currentSolved = progress[activePuzzlePack.id]?.solved || 0;
  const nextSolved = Math.max(currentSolved, activePuzzlePackPosition + 1);
  const alreadyComplete = currentSolved >= total;

  progress[activePuzzlePack.id] = {
    solved: Math.min(nextSolved, total),
    completed: nextSolved >= total,
  };
  savePuzzlePackProgress(progress);

  if (nextSolved >= total && !alreadyComplete) {
    awardCoins(activePuzzlePack.reward);
    setText(
      d.message,
      `${activePuzzlePack.title} complete! Bonus: ${activePuzzlePack.reward} coins.`,
    );
  }
}

function isInsidePuzzlePack() {
  return Boolean(activePuzzlePack);
}

function hasNextPuzzleInPack() {
  return Boolean(
    activePuzzlePack &&
    activePuzzlePackPosition + 1 < activePuzzlePack.puzzles.length,
  );
}

function goToNextPuzzleInPack() {
  if (!activePuzzlePack) return;
  if (hasNextPuzzleInPack()) {
    activePuzzlePackPosition += 1;
    startPuzzle(activePuzzlePack.puzzles[activePuzzlePackPosition], true);
    return;
  }
  backToPuzzlePackList();
}

function backToPuzzlePackList() {
  activePuzzlePack = null;
  activePuzzlePackPosition = 0;
  stopClock();
  showPuzzlePacks();
}

function updatePuzzlePackGameButtons() {
  if (!d.newGameBtn) return;
  d.newGameBtn.classList.toggle("hidden", isInsidePuzzlePack());
}

function isPuzzleMoveCorrect(nodeId) {
  if (!activePuzzle || nodeId !== activePuzzle.solution) return false;
  if (
    activePuzzle.title === "Block First" ||
    activePuzzle.title === "Center Control"
  )
    return true;
  return Boolean(findWin(P1));
}

function startPuzzle(i = puzzleToday(), practice = false) {
  puzzleSolved = false;
  activePuzzle = { ...puzzles[i], index: i, isPractice: practice };
  mode = "puzzle";
  board = [...activePuzzle.board];
  turn = P1;
  phase = activePuzzle.phase;
  gameWinner = null;
  winLine = [];
  selected = activePuzzle.solutionFrom ?? null;
  available = selected === null ? [] : emptyNs(selected);
  moves = 0;
  d.gameModeText.textContent = isInsidePuzzlePack()
    ? activePuzzlePack.title
    : practice
      ? "Practice Puzzle"
      : "Daily Puzzle";
  d.message.textContent = activePuzzle.instruction;
  d.rematchBtn.textContent = "Try Again";
  d.rematchBtn.classList.add("hidden");
  updatePuzzlePackGameButtons();
  hideCoach();
  startClock();
  render();
  showScreen("gameScreen");
}
function completePuzzle(ok) {
  stopClock();
  puzzleSolved = ok;
  gameWinner = ok ? P1 : P2;
  if (ok) {
    d.message.textContent = activePuzzle.isPractice
      ? "Practice puzzle solved!"
      : "Daily puzzle solved!";
    fire();
    ping("win");
    addPuzzleReward();
    completePuzzlePackStep();
    coach(P1);
  } else {
    d.message.textContent =
      "Not the best move. Click Try Again to reset this puzzle.";
    ping("error");
    coach(P2);
  }
  d.rematchBtn.textContent =
    isInsidePuzzlePack() && ok
      ? hasNextPuzzleInPack()
        ? "Next Puzzle"
        : "Back to Pack List"
      : "Try Again";
  d.rematchBtn.classList.remove("hidden");
  updatePuzzlePackGameButtons();
  render();
}
function applyState(s) {
  board = s.board;
  turn = s.currentTurn;
  phase = s.phase;
  gameWinner = s.winner;
  winLine = s.winLine || [];
  moves = s.moveCount || 0;
  if (s.playerCount < 2) {
    d.message.textContent = "Waiting for another player to join.";
    render();
    return;
  }
  if (gameWinner) {
    d.message.textContent =
      gameWinner === onlinePlayer ? `${playerName} wins!` : "Opponent wins.";
    record(gameWinner === onlinePlayer ? "win" : "loss", "online", "Friend");
    stopClock();
    fire();
    coach(gameWinner);
    d.rematchBtn.classList.remove("hidden");
    render();
    return;
  }
  d.rematchBtn.classList.add("hidden");
  d.message.textContent =
    turn === onlinePlayer
      ? phase === "moving"
        ? "Your turn. Move one stone."
        : "Your turn. Place one stone."
      : "Waiting for opponent move.";
  render();
}
function tournamentNames() {
  const size = Number(d.tournamentSizeSelect.value);
  const names = d.tournamentNamesInput.value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  while (names.length < size) names.push(`Player ${names.length + 1}`);
  return names.slice(0, size);
}
function startTournament() {
  const players = tournamentNames();
  tournament = { round: 1, players, matches: [], current: 0, champion: null };
  buildRound();
  d.tournamentBracket.classList.remove("hidden");
  renderTournament();
}
function buildRound() {
  tournament.matches = [];
  tournament.current = 0;
  for (let i = 0; i < tournament.players.length; i += 2)
    tournament.matches.push({
      player: tournament.players[i],
      opponent: tournament.players[i + 1] || "BYE",
      winner: null,
    });
}
function renderTournament() {
  d.tournamentRoundTitle.textContent = tournament.champion
    ? "Champion"
    : `Round ${tournament.round}`;
  d.bracketList.innerHTML = "";
  if (tournament.champion) {
    d.tournamentStatus.textContent = `${tournament.champion} is champion!`;
    return;
  }
  tournament.matches.forEach((m) => {
    const row = document.createElement("div");
    row.className = "bracket-match";
    row.innerHTML = `<span>${m.player}</span><span class="bracket-vs">vs</span><span>${m.opponent}${m.winner ? ` → Winner: ${m.winner}` : ""}</span>`;
    d.bracketList.appendChild(row);
  });
  const next = tournament.matches[tournament.current];
  d.tournamentStatus.textContent = next
    ? `Next match: ${next.player} vs ${next.opponent}`
    : "Round complete.";
}
function playTournament() {
  const m = tournament.matches[tournament.current];
  if (!m) return finishRound();
  if (m.opponent === "BYE") {
    m.winner = m.player;
    tournament.current++;
    renderTournament();
    return;
  }
  playerName = m.player;
  mode = "tutorial";
  resetBoard();
  d.gameModeText.textContent = `Tournament: ${m.player} vs ${m.opponent}`;
  showScreen("gameScreen");
}
function handleTournamentResult(w) {
  if (!tournament || mode !== "tutorial") return;
  const m = tournament.matches[tournament.current];
  if (!m) return;
  m.winner = w === P1 ? m.player : m.opponent;
  tournament.current++;
  if (tournament.current >= tournament.matches.length) finishRound();
}
function finishRound() {
  const winners = tournament.matches.map((m) => m.winner).filter(Boolean);
  if (winners.length <= 1) {
    tournament.champion = winners[0] || "No winner";
    renderTournament();
    showScreen("tournamentScreen");
    return;
  }
  tournament.players = winners;
  tournament.round++;
  buildRound();
  renderTournament();
  showScreen("tournamentScreen");
}
function applyAccess() {
  const s = JSON.parse(localStorage.getItem("accessV301") || "null") || {
    large: false,
    contrast: false,
    numbers: false,
  };
  document.body.classList.toggle("large-nodes", s.large);
  document.body.classList.toggle("high-contrast", s.contrast);
  document.body.classList.toggle("show-node-numbers", s.numbers);
  d.largeNodesToggle.checked = s.large;
  d.highContrastToggle.checked = s.contrast;
  d.nodeNumbersToggle.checked = s.numbers;
}
function saveAccess() {
  localStorage.setItem(
    "accessV301",
    JSON.stringify({
      large: d.largeNodesToggle.checked,
      contrast: d.highContrastToggle.checked,
      numbers: d.nodeNumbersToggle.checked,
    }),
  );
  applyAccess();
}
function applyTheme() {
  if (!isThemeUnlocked(theme)) {
    setText(d.message, "This theme is locked. Unlock it in the Rewards Store.");
    theme = "classic";
    if (d.themeSelect) d.themeSelect.value = theme;
  }
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
    "pieces-animals",
  );
  document.body.classList.add(`theme-${theme}`, `pieces-${pieceSet}`);
  render();
}
function registerPwa() {
  // Disabled in v3.0.3 Codespaces-safe build.
  // This prevents private Codespaces port redirects from breaking manifest/service worker loading.
  if (d.installBtn) d.installBtn.classList.add("hidden");
}

function openDifficultyModal() {
  if (!d.difficultyModal) return;
  d.difficultyModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  const selectedButton = d.difficultyModal.querySelector(
    `[data-difficulty="${difficulty}"]`,
  );
  selectedButton?.focus();
}

function closeDifficultyModal() {
  if (!d.difficultyModal) return;
  d.difficultyModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  d.playPcBtn?.focus();
}

function selectDifficulty(level) {
  difficulty = level;
  if (d.difficultySelect) d.difficultySelect.value = level;
  d.difficultyModal
    ?.querySelectorAll("[data-difficulty]")
    .forEach((button) =>
      button.classList.toggle("selected", button.dataset.difficulty === level),
    );
}

function startSelectedPcGame() {
  closeDifficultyModal();
  resetGame();
  showScreen("gameScreen");
}

function wire() {
  if (d.soundToggle) {
    d.soundToggle.checked = soundOn;
    d.soundToggle.addEventListener("change", () => {
      soundOn = d.soundToggle.checked;
      localStorage.setItem("soundOnV330", String(soundOn));
    });
  }
  d.loginBtn.onclick = () => showScreen("loginScreen");
  d.registerBtn.onclick = () => showScreen("registerScreen");
  d.createAccountBtn.onclick = createAccount;
  d.loginAccountBtn.onclick = loginAccount;
  d.logoutBtn.onclick = logoutAccount;
  d.profileBtn.onclick = profile;
  d.leaderboardBtn.onclick = leaderboard;
  safeOn(d.achievementsBtn, "click", showAchievements);
  safeOn(d.rewardsBtn, "click", showRewardsStore);
  safeOn(d.claimDailyRewardBtn, "click", claimDailyReward);
  d.playPcBtn.onclick = openDifficultyModal;
  safeOn(d.closeDifficultyModalBtn, "click", closeDifficultyModal);
  safeOn(d.startPcGameBtn, "click", startSelectedPcGame);
  d.difficultyModal
    ?.querySelectorAll("[data-difficulty]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        selectDifficulty(button.dataset.difficulty),
      ),
    );
  safeOn(d.difficultyModal, "click", (event) => {
    if (event.target === d.difficultyModal) closeDifficultyModal();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !d.difficultyModal?.classList.contains("hidden")
    ) {
      closeDifficultyModal();
    }
  });
  d.playOnlineBtn.onclick = () => {
    if (!ONLINE_AVAILABLE) {
      showOnlineRequiredMessage();
      showScreen("homeScreen");
      return;
    }
    showScreen("onlineMenuScreen");
  };
  d.dailyPuzzleBtn.onclick = () => {
    updatePuzzle();
    showScreen("dailyPuzzleScreen");
  };
  d.startDailyPuzzleBtn.onclick = () => {
    puzzleIndex = puzzleToday();
    startPuzzle(puzzleIndex, false);
  };
  d.nextPracticePuzzleBtn.onclick = () => {
    puzzleIndex = (puzzleIndex + 1) % puzzles.length;
    startPuzzle(puzzleIndex, true);
  };
  d.tournamentBtn.onclick = () => {
    d.tournamentNamesInput.value = `${playerName}\nPlayer 2\nPlayer 3\nPlayer 4`;
    showScreen("tournamentScreen");
  };
  d.startTournamentBtn.onclick = startTournament;
  d.playTournamentMatchBtn.onclick = playTournament;
  d.statsBtn.onclick = () => {
    updateStatsUI();
    showScreen("statsScreen");
  };
  d.resetStatsBtn.onclick = resetStats;
  d.tutorialBtn.onclick = () => showScreen("tutorialScreen");
  safeOn(d.puzzlePacksBtn, "click", showPuzzlePacks);
  d.startTutorialBtn.onclick = () => {
    difficulty = "easy";
    resetGame();
    mode = "tutorial";
    d.gameModeText.textContent = "Tutorial Game";
    showScreen("gameScreen");
  };
  d.rulesBtn.onclick = () => showScreen("rulesScreen");
  d.accessibilityBtn.onclick = () => showScreen("accessibilityScreen");
  d.saveAccessibilityBtn.onclick = saveAccess;
  d.resetAccessibilityBtn.onclick = () => {
    localStorage.removeItem("accessV301");
    applyAccess();
  };
  d.customizeBtn.onclick = () => showScreen("customizeScreen");
  d.themeSelect.onchange = () => {
    theme = d.themeSelect.value;
    applyTheme();
  };
  d.pieceSelect.onchange = () => {
    pieceSet = d.pieceSelect.value;
    applyTheme();
  };
  d.saveThemeBtn.onclick = () =>
    localStorage.setItem("themeV301", JSON.stringify({ theme, pieceSet }));
  d.resetThemeBtn.onclick = () => {
    theme = "classic";
    pieceSet = "dots";
    d.themeSelect.value = theme;
    d.pieceSelect.value = pieceSet;
    applyTheme();
  };
  d.hintBtn.onclick = showHint;
  d.newGameBtn.onclick = () => {
    if (isInsidePuzzlePack()) return;
    mode === "puzzle"
      ? startPuzzle(
          activePuzzle?.index ?? puzzleIndex,
          activePuzzle?.isPractice ?? true,
        )
      : resetGame();
  };
  d.rematchBtn.onclick = () => {
    if (mode === "puzzle") {
      if (isInsidePuzzlePack()) {
        if (puzzleSolved) goToNextPuzzleInPack();
        else startPuzzle(activePuzzle?.index ?? puzzleIndex, true);
        return;
      }
      startPuzzle(
        activePuzzle?.index ?? puzzleIndex,
        activePuzzle?.isPractice ?? true,
      );
    } else if (mode === "online" || mode === "random") {
      socket.emit("request-rematch");
      d.message.textContent = "Rematch requested. Waiting for opponent...";
    } else resetGame();
  };
  d.exitGameBtn.onclick = () => {
    if (isInsidePuzzlePack()) {
      backToPuzzlePackList();
      return;
    }
    stopClock();
    showScreen("homeScreen");
  };
  d.friendModeBtn.onclick = () => showScreen("friendScreen");
  d.randomModeBtn.onclick = () => {
    if (!ONLINE_AVAILABLE) {
      showOnlineRequiredMessage();
      return;
    }
    mode = "random";
    startClock();
    showScreen("randomScreen");
    socket.emit("random-match");
  };
  d.createRoomBtn.onclick = () => {
    if (!ONLINE_AVAILABLE) {
      showOnlineRequiredMessage();
      return;
    }
    mode = "online";
    startClock();
    socket.emit("create-room");
  };
  d.joinRoomBtn.onclick = () => {
    if (!ONLINE_AVAILABLE) {
      showOnlineRequiredMessage();
      return;
    }
    const code = d.joinCodeInput.value.trim().toUpperCase();
    if (code) {
      mode = "online";
      startClock();
      socket.emit("join-room", code);
    }
  };
  d.copyCodeBtn.onclick = async () => {
    if (roomId) await navigator.clipboard.writeText(roomId);
  };
  d.copyLinkBtn.onclick = async () => {
    if (d.roomLinkInput.value)
      await navigator.clipboard.writeText(d.roomLinkInput.value);
  };
  d.installBtn.onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    d.installBtn.classList.add("hidden");
  };
  document
    .querySelectorAll(".back-btn[data-screen]")
    .forEach((b) => (b.onclick = () => showScreen(b.dataset.screen)));
}
function wireSocket() {
  socket.on("joined-room", ({ roomId: rid, player, state }) => {
    onlinePlayer = player;
    roomId = rid;
    selected = null;
    available = [];
    const link = `${location.origin}/room/${rid}`;
    d.createdRoomBox.classList.remove("hidden");
    d.roomCodeDisplay.textContent = rid;
    d.roomLinkInput.value = link;
    d.onlineRoomBadge.textContent = `Room: ${rid}`;
    d.onlineInfo.classList.remove("hidden");
    d.gameModeText.textContent =
      mode === "random" ? "Random Opponent" : "Play with Friend";
    history.replaceState({}, "", `/room/${rid}`);
    showScreen("gameScreen");
    applyState(state);
  });
  socket.on("room-state", (s) => {
    if (onlinePlayer) applyState(s);
  });
  socket.on("stone-selected", ({ selectedNode, availableMoves }) => {
    selected = selectedNode;
    available = availableMoves || [];
    render();
  });
  socket.on("waiting-random", (t) => (d.randomStatus.textContent = t));
  socket.on("room-error", (t) => {
    d.friendStatus.textContent = t;
    d.message.textContent = t;
    ping("error");
  });
  socket.on("opponent-left", (t) => {
    d.connectionBadge.textContent = "🔴 Disconnected";
    d.message.textContent = t;
  });
  socket.on("rematch-status", ({ votes, needed }) => {
    d.message.textContent = votes.includes(onlinePlayer)
      ? `Rematch requested. Waiting for opponent (${votes.length}/${needed}).`
      : "Opponent wants a rematch. Click Rematch to accept.";
    d.rematchBtn.classList.remove("hidden");
  });
  socket.on("rematch-started", (s) => {
    selected = null;
    available = [];
    gameWinner = null;
    winLine = [];
    moves = 0;
    hideCoach();
    startClock();
    applyState(s);
  });
}

const savedTheme = JSON.parse(localStorage.getItem("themeV301") || "null");
if (savedTheme) {
  theme = savedTheme.theme;
  pieceSet = savedTheme.pieceSet;
  d.themeSelect.value = theme;
  d.pieceSelect.value = pieceSet;
}
applyAccess();
applyTheme();
addBrandingToAllCards();
updateRewardBadges();
const acc = currentAccount();
if (acc) {
  playerName = acc.username;
  if (d.playerNameInput) d.playerNameInput.value = acc.username;
  loadAccountStats(acc);
}
updateAccountUI();
updateRewardBadges();
updateStatsUI();
updateClock();
if (d.soundToggle) d.soundToggle.checked = soundOn;
wire();
updateStaticSafeUi();
wireSocket();
registerPwa();
restoreServerSession();
const match = location.pathname.match(/^\/room\/([A-Z0-9]+)$/i);
if (match) {
  if (ONLINE_AVAILABLE) {
    mode = "online";
    startClock();
    socket.emit("join-room", match[1]);
  } else {
    showOnlineRequiredMessage();
  }
}
