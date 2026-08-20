# Three Stones v3.2.6 Puzzle Pack Fix Original

This build is based on the original `three-stones-v3.2-puzzle-packs` files you provided.

## Changed

- Fixed Puzzle Pack flow:
  - Wrong move -> Try Again resets the same puzzle.
  - Correct move -> Next Puzzle.
  - Last puzzle -> Back to Pack List.
  - Menu inside a Puzzle Pack game -> Puzzle Pack list.
  - New Game button hidden inside Puzzle Packs.
- Fixed puzzle board locking after success or failure.
- Prevented placing more than 3 player stones in puzzle mode.
- Preserved the original full `server.js` online room logic.
- Kept the original service worker active, only renamed the cache to v3.2.6.

## Run

```bash
npm install
npm install express
npm install socket.io
npm start
```

Then open:

```text
http://localhost:3000
```
