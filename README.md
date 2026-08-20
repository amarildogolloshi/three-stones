# Three Stones v3.4.0 SQLite

This version adds a persistent SQLite database while preserving all features from v3.3.0.

## SQLite-backed data

- Accounts with securely hashed passwords
- Login sessions
- Player rating and stats
- Match history
- Coins, achievements, unlocked themes, and daily rewards
- Puzzle Pack progress
- Server-backed leaderboard

Guest players still use localStorage. Signed-in players use SQLite as the persistent source, with localStorage retained as an offline/browser cache.

## Run

```bash
npm install
npm install express
npm install socket.io
mpm install better-sqlite3
npm start
```

The database is created automatically at:

```text
data/three-stones.db
```

Inspect row counts with:

```bash
npm run db:info
```

To store the database elsewhere:

```bash
THREE_STONES_DB_PATH=/persistent/path/three-stones.db npm start
```

## Production note

Use a persistent disk or volume. Do not commit database files. Back up the database and its WAL files consistently.
