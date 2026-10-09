import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";
import { seedIncident } from "../src/seed.ts";

function setup() { const db = openDatabase(":memory:"); seedIncident(db); return { db, app: createApp(db) }; }
function approve(app: ReturnType<typeof createApp>, mission_id: string, approved_at: string, idempotency_key: string) {
  return app.request("/approvals", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mission_id, approved_at, idempotency_key }) });
}

describe("regressões do incidente", () => {
  it("aceita o último milissegundo civil e recusa o seguinte", async () => {
    const { app } = setup();
    expect((await approve(app, "msn_1842", "2026-03-13T02:59:59.999Z", "fim")).status).toBe(201);
    const other = setup().app;
    expect((await approve(other, "msn_1842", "2026-03-13T03:00:00.000Z", "tarde")).status).toBe(409);
  });
  it("remove U+200B e impede segunda chave na mesma missão", async () => {
    const { app } = setup();
    const when = "2026-03-12T18:11:00.000Z";
    expect((await approve(app, "msn_1900", when, "pay_22a")).status).toBe(201);
    expect((await approve(app, "msn_1900", when, "pay_22a\u200B")).status).toBe(200);
    expect((await approve(app, "msn_1900", when, "outra-chave")).status).toBe(200);
    const result = await app.request("/missions/msn_1900");
    expect(((await result.json()) as { ledger: unknown[] }).ledger).toHaveLength(1);
  });
});
