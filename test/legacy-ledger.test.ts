import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { openDatabase } from "../src/db.ts";

for (const scenario of ["mission", "key"] as const) {
  it(`preserva lançamentos antigos com duplicidade de ${scenario}`, () => {
    const path = join(process.cwd(), "test", `legacy-${crypto.randomUUID()}.sqlite`);
    try {
      const legacy = new DatabaseSync(path);
      legacy.exec(`CREATE TABLE ledger (
        id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
        amount_brl REAL NOT NULL, created_at TEXT NOT NULL
      )`);
      const insert = legacy.prepare("INSERT INTO ledger VALUES (?, ?, ?, ?, ?)");
      insert.run("l1", "m1", "k1", 150, "2026-03-12T18:00:00Z");
      insert.run("l2", scenario === "mission" ? "m1" : "m2", scenario === "key" ? "k1" : "k2", 150, "2026-03-12T19:00:00Z");
      const before = legacy.prepare("SELECT * FROM ledger ORDER BY id").all();
      legacy.close();

      expect(() => openDatabase(path)).toThrow(/reconcilie os lançamentos/);
      const after = new DatabaseSync(path);
      try {
        expect(after.prepare("SELECT * FROM ledger ORDER BY id").all()).toEqual(before);
        expect(after.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'idx_ledger_%'").all()).toHaveLength(0);
      } finally { after.close(); }
    } finally { unlinkSync(path); }
  });
}
