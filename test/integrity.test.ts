import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";
import { seedIncident } from "../src/seed.ts";

function setup() { const db = openDatabase(":memory:"); seedIncident(db); return { db, app: createApp(db) }; }
function approve(app: ReturnType<typeof createApp>, key = "key", mission = "msn_1900", date = "2026-03-12T18:00:00Z") {
  return app.request("/approvals", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mission_id: mission, approved_at: date, idempotency_key: key }) });
}

describe("integridade dos repasses", () => {
  it("recusa chave invisível e data inválida sem escrever no banco", async () => {
    const { db, app } = setup();
    try {
      expect((await approve(app, " \u200B\uFEFF ")).status).toBe(400);
      expect((await approve(app, "key", "msn_1900", "invalid")).status).toBe(400);
      expect(db.prepare("SELECT COUNT(*) AS n FROM ledger").get()!.n).toBe(0);
      expect(db.prepare("SELECT COUNT(*) AS n FROM payouts").get()!.n).toBe(0);
    } finally { db.close(); }
  });
  it("rejeita a reutilização global de uma chave por outra missão", async () => {
    const { db, app } = setup();
    try {
      expect((await approve(app)).status).toBe(201);
      expect((await approve(app, " KEY\u200B ", "msn_2044")).status).toBe(409);
      expect(db.prepare("SELECT COUNT(*) AS n FROM ledger").get()!.n).toBe(1);
      expect(db.prepare("SELECT status FROM missions WHERE id='msn_2044'").get()!.status).toBe("open");
    } finally { db.close(); }
  });
  it("status desconhecido não sobrescreve um repasse confirmado", async () => {
    const { db, app } = setup();
    try {
      const result = await (await approve(app)).json() as { payout: { id: string } };
      const callback = (status: string) => app.request(`/payouts/${result.payout.id}/provider`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider_status: status }),
      });
      expect((await callback("CONFIRMED")).status).toBe(200);
      expect((await callback("INVALID")).status).toBe(400);
      expect(db.prepare("SELECT status, provider_status FROM payouts").get()).toMatchObject({ status: "paid", provider_status: "CONFIRMED" });
    } finally { db.close(); }
  });
  it("falha ao inserir payout desfaz ledger e aprovação; retry funciona", async () => {
    const { db, app } = setup();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.exec("CREATE TRIGGER fail_payout BEFORE INSERT ON payouts BEGIN SELECT RAISE(ABORT, 'test failure'); END");
      expect((await approve(app)).status).toBe(500);
      expect(db.prepare("SELECT COUNT(*) AS n FROM ledger").get()!.n).toBe(0);
      expect(db.prepare("SELECT status FROM missions WHERE id='msn_1900'").get()!.status).toBe("open");
      db.exec("DROP TRIGGER fail_payout");
      expect((await approve(app)).status).toBe(201);
    } finally { errorLog.mockRestore(); db.close(); }
  });
  it("tentativas simultâneas com chaves distintas produzem um único crédito", async () => {
    const { db, app } = setup();
    try {
      const replies = await Promise.all(Array.from({ length: 20 }, (_, i) => approve(app, `retry-${i}`)));
      expect(replies.filter(r => r.status === 201)).toHaveLength(1);
      expect(replies.filter(r => r.status === 200)).toHaveLength(19);
      expect(db.prepare("SELECT COUNT(*) AS n FROM ledger").get()!.n).toBe(1);
      expect(db.prepare("SELECT COUNT(*) AS n FROM payouts").get()!.n).toBe(1);
    } finally { db.close(); }
  });
});
