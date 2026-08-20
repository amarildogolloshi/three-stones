import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath =
  process.env.THREE_STONES_DB_PATH ||
  path.join(dataDirectory, "three-stones.db");
export const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🐺',
    rating INTEGER NOT NULL DEFAULT 1000,
    games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    best_time INTEGER,
    fewest_moves INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rewards (
    user_id TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 0,
    achievements_json TEXT NOT NULL DEFAULT '[]',
    unlocked_themes_json TEXT NOT NULL DEFAULT '["classic","dark"]',
    puzzles_solved INTEGER NOT NULL DEFAULT 0,
    daily_reward_date TEXT,
    daily_streak INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS puzzle_progress (
    user_id TEXT NOT NULL,
    pack_id TEXT NOT NULL,
    solved INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, pack_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
    mode TEXT NOT NULL,
    opponent TEXT NOT NULL,
    moves INTEGER NOT NULL DEFAULT 0,
    seconds INTEGER NOT NULL DEFAULT 0,
    rating_change INTEGER NOT NULL DEFAULT 0,
    played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_matches_user_date ON matches(user_id, played_at DESC);
  CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
`);

export function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    rating: row.rating,
    games: row.games,
    wins: row.wins,
    losses: row.losses,
    bestTime: row.best_time,
    fewestMoves: row.fewest_moves,
  };
}

export function getFullState(userId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return null;
  const rewardRow = db
    .prepare("SELECT * FROM rewards WHERE user_id = ?")
    .get(userId);
  const packs = db
    .prepare(
      "SELECT pack_id, solved, completed FROM puzzle_progress WHERE user_id = ?",
    )
    .all(userId);
  const history = db
    .prepare(
      `
    SELECT result, mode, opponent, moves, seconds, rating_change AS ratingChange,
           played_at AS date
    FROM matches WHERE user_id = ? ORDER BY id DESC LIMIT 20
  `,
    )
    .all(userId);
  return {
    user: publicUser(user),
    stats: { ...publicUser(user), history },
    rewards: rewardRow
      ? {
          coins: rewardRow.coins,
          achievements: parseJson(rewardRow.achievements_json, []),
          unlockedThemes: parseJson(rewardRow.unlocked_themes_json, [
            "classic",
            "dark",
          ]),
          puzzlesSolved: rewardRow.puzzles_solved,
          dailyRewardDate: rewardRow.daily_reward_date,
          dailyStreak: rewardRow.daily_streak,
        }
      : null,
    puzzleProgress: Object.fromEntries(
      packs.map((pack) => [
        pack.pack_id,
        {
          solved: pack.solved,
          completed: Boolean(pack.completed),
        },
      ]),
    ),
  };
}
