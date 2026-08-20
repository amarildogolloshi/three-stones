import { db } from "../database.js";

const tables = ["users", "sessions", "rewards", "puzzle_progress", "matches"];
console.log("Three Stones SQLite database");
for (const table of tables) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  console.log(`${table}: ${row.count}`);
}
