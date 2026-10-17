import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import bcrypt from "bcryptjs";
import { bearer, clearDb, registerTenant, startDb, stopDb, type Session } from "./setup.js";
import { User } from "../src/models/index.js";
import { recordAi, aiQuota, currentMonth, assertAiQuota } from "../src/lib/aiUsage.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("uso de IA y límite mensual", () => {
  let owner: Session;
  let sa: { Authorization: string };
  beforeEach(async () => {
    owner = await registerTenant(app, "Taller IA", "ia@test.com");
    await User.create({ tenantId: null, name: "SA", email: "sa-ia@test.com", passwordHash: await bcrypt.hash("secret123", 4), role: "superadmin", active: true });
    const login = await request(app).post("/api/auth/login").send({ email: "sa-ia@test.com", password: "secret123" });
    sa = { Authorization: `Bearer ${login.body.token}` };
  });

  it("registra llamadas, tokens y costo estimado por taller y mes", async () => {
    await recordAi(owner.tenantId, { promptTokens: 1000, completionTokens: 200 });
    await recordAi(owner.tenantId, { transcription: true, audioSeconds: 60 });
    const q = await aiQuota(owner.tenantId);
    expect(q.used).toBe(2);
    const u = await request(app).get("/api/superadmin/ai-usage").set(sa);
    expect(u.status).toBe(200);
    expect(u.body.month).toBe(currentMonth());
    const row = u.body.items.find((x: { tenantId: string }) => x.tenantId === owner.tenantId);
    expect(row.calls).toBe(2);
    expect(row.transcriptions).toBe(1);
    expect(row.costUsd).toBeGreaterThan(0);
    expect(u.body.totals.calls).toBeGreaterThanOrEqual(2);
  });

  it("al llegar al límite, la IA se bloquea y el asistente sigue funcionando en local", async () => {
    const set = await request(app).patch(`/api/superadmin/tenants/${owner.tenantId}`).set(sa).send({ aiCallsLimit: 1 });
    expect(set.status).toBe(200);
    expect(set.body.aiCallsLimit).toBe(1);
    await recordAi(owner.tenantId, { promptTokens: 10, completionTokens: 10 });
    await expect(assertAiQuota(owner.tenantId)).rejects.toMatchObject({ status: 429, code: "AI_LIMIT" });
    const r = await request(app).post("/api/assistant").set(bearer(owner)).send({ text: "qué tengo bajo de stock" });
    expect(r.status).toBe(200);
    expect(r.body.intent).toBe("consultar_inventario");
  });

  it("el superadmin ve la serie de 6 meses de un taller y el límite se puede cambiar", async () => {
    const s = await request(app).get(`/api/superadmin/tenants/${owner.tenantId}/ai-usage`).set(sa);
    expect(s.status).toBe(200);
    expect(s.body.series).toHaveLength(6);
    expect(s.body.limit).toBe(300);
    expect((await request(app).patch(`/api/superadmin/tenants/${owner.tenantId}`).set(sa).send({ aiCallsLimit: -5 })).status).toBe(400);
  });

  it("solo el superadmin accede al uso de IA", async () => {
    expect((await request(app).get("/api/superadmin/ai-usage").set(bearer(owner))).status).toBe(403);
  });
});
