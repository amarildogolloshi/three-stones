# Three Stones

## Play
Play this game here:https://amarildogolloshi.github.io/three-stones/

## Three Stones v2 Phase 1

Phase 1 features added:

- Player name screen
- PC difficulty: Easy, Medium, Hard
- Move counter
- Match timer
- Sound toggle
- Place, move, and win sounds
- Rematch button
- Dark stones and centered symbols
- Winning animation
- Firework victory effect
- Basic touch and pointer support
- Existing online room and random opponent support kept

## Three Stones v2.3 Ranking and Stats
This version adds Phase 3 features:

Local player statistics
Ranking points
Rank titles
Match history
Win rate
Best time
Fewest moves
Reset stats button
Stats panel on home screen
Match result saving for PC and online games

## Three Stones v2.4 Themes Pieces

- Board themes
- Piece sets
- Theme and piece preview controls
- Saved preferences using browser localStorage
- Settings screen
- Visual customizations work in PC and online modes

### Themes

- Classic
- Dark
- Wood
- Neon
- Stone
- Space

### Piece Sets

- Dots
- Stars
- Gems
- Shields
- Animals

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
