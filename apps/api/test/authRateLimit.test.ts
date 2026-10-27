import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bearer, clearDb, registerTenant, startDb, stopDb, type Session } from "./setup.js";
import { createApp, RATE_LIMITS } from "../src/app.js";

// La app compartida de los tests tiene límites altos. Aquí cada test usa una app nueva con
// los límites de producción, así cada uno empieza con el cupo completo para 127.0.0.1.
let shared: Express;
let limited: Express;
let s: Session;
const EMAIL = "limite@test.com";

beforeAll(async () => {
  shared = await startDb();
});
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  s = await registerTenant(shared, "Taller Límite", EMAIL);
  limited = createApp({ rateLimits: RATE_LIMITS });
});

const login = (password: string) => request(limited).post("/api/auth/login").send({ email: EMAIL, password });

describe("límite de peticiones de /api/auth", () => {
  it("GET /me con token válido no gasta el cupo de credenciales", async () => {
    const calls = RATE_LIMITS.credentials + 10;
    for (let i = 0; i < calls; i++) {
      const r = await request(limited).get("/api/auth/me").set(bearer(s));
      expect(r.status, `llamada ${i + 1} a /me`).toBe(200);
      expect(r.body.user.email).toBe(EMAIL);
    }
    // Tras más llamadas a /me que el cupo de credenciales, el login sigue con el cupo entero.
    const r = await login("secret123");
    expect(r.status).toBe(200);
    expect(r.headers["ratelimit-limit"]).toBe(String(RATE_LIMITS.credentials));
    expect(r.headers["ratelimit-remaining"]).toBe(String(RATE_LIMITS.credentials - 1));
  });

  it("el login sigue limitado: la petición 61 de la ventana da 429", async () => {
    expect(RATE_LIMITS.credentials).toBe(60);
    for (let i = 0; i < RATE_LIMITS.credentials; i++) {
      expect((await login("clave-equivocada")).status, `intento ${i + 1}`).toBe(401);
    }
    // Ni con la contraseña correcta: el cupo de la ventana ya se gastó.
    const blocked = await login("secret123");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBeDefined();

    // Las demás rutas que reciben credenciales comparten ese cupo.
    const reg = await request(limited)
      .post("/api/auth/register")
      .send({ tenantName: "Otro", type: "motos", ownerName: "Owner", email: "otro@test.com", password: "secret123", city: "Bogotá", phone: "3001234567" });
    expect(reg.status).toBe(429);
    const pwd = await request(limited).post("/api/auth/password").set(bearer(s)).send({ currentPassword: "x", newPassword: "secret456" });
    expect(pwd.status).toBe(429);

    // La sesión ya abierta sigue funcionando aunque el login esté bloqueado.
    const me = await request(limited).get("/api/auth/me").set(bearer(s));
    expect(me.status).toBe(200);
    expect(me.headers["ratelimit-limit"]).toBe(String(RATE_LIMITS.session));
  });
});
