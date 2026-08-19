# Three Stones v3.0 Leaderboard and Accounts

This version adds the first account and leaderboard phase on top of v2.9.

## Added in v3.0

- Local account system
- Register screen
- Login screen
- Logout button
- Profile screen
- Local leaderboard screen
- Account-linked stats
- Ranking points are synced to the active profile
- Guest mode still works

## Important

This v3.0 version uses browser `localStorage` accounts. It is safe for testing and does not require a database. A future v3.1 or v4.0 can connect this to Supabase, Firebase, MongoDB, or PostgreSQL for real cloud accounts and global leaderboards.

## Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```
