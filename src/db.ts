import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  deadline_date TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount_brl REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL UNIQUE,
  provider_status TEXT,
  status TEXT NOT NULL
);
`;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  const duplicate = db.prepare(`
    SELECT mission_id AS value FROM ledger GROUP BY mission_id HAVING COUNT(*) > 1
    UNION ALL
    SELECT idempotency_key AS value FROM ledger GROUP BY idempotency_key HAVING COUNT(*) > 1
    LIMIT 1
  `).get();
  if (duplicate) {
    db.close();
    throw new Error("Ledger antigo contém duplicatas; reconcilie os lançamentos antes de criar índices únicos");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_one_per_mission ON ledger(mission_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency ON ledger(idempotency_key);
  `);
  return db;
}
