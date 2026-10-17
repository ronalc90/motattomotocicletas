import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bearer, clearDb, registerTenant, startDb, stopDb } from "./setup.js";
import { keyBelongsTo } from "../src/services/storage.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("fotos privadas", () => {
  it("una clave solo pertenece a su taller", () => {
    expect(keyBelongsTo("abc", "tenants/abc/products/x.jpg")).toBe(true);
    expect(keyBelongsTo("abc", "tenants/xyz/products/x.jpg")).toBe(false);
    expect(keyBelongsTo("abc", "tenants/abc/../xyz/x.jpg")).toBe(false);
  });

  it("sin sesión no se puede leer ningún archivo", async () => {
    const r = await request(app).get("/api/files/tenants/abc/products/x.jpg");
    expect(r.status).toBe(401);
  });

  it("un taller no puede pedir la foto de otro taller", async () => {
    const owner = await registerTenant(app, "Taller Fotos", "fotos@test.com");
    const r = await request(app).get("/api/files/tenants/otro-taller/products/x.jpg").set(bearer(owner));
    expect(r.status).toBe(404);
  });
});
