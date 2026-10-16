import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bearer, clearDb, createCustomerVehicle, createProduct, registerTenant, startDb, stopDb, type Session } from "./setup.js";
import { parseSpanishNumber, splitPrice } from "../src/services/spanishNumbers.js";

let app: Express;
beforeAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("spanish numbers", () => {
  it("parses number words", () => {
    expect(parseSpanishNumber("treinta y dos mil")).toBe(32000);
    expect(parseSpanishNumber("veintiséis mil")).toBe(26000);
    expect(parseSpanishNumber("doscientos setenta y cuatro mil")).toBe(274000);
    expect(parseSpanishNumber("26 mil")).toBe(26000);
    expect(parseSpanishNumber("un millón doscientos mil")).toBe(1200000);
    expect(parseSpanishNumber("mil quinientos")).toBe(1500);
    expect(splitPrice("bujía NS 200 a treinta y dos mil")).toEqual({ text: "bujia ns 200", price: 32000 });
    expect(splitPrice("aceite $65.000")).toEqual({ text: "aceite", price: 65000 });
    expect(splitPrice("aceite en 65 mil").price).toBe(65000);
    expect(splitPrice("filtro de aceite").price).toBeNull();
  });
});

describe("assistant fallback", () => {
  let s: Session;
  beforeEach(async () => {
    s = await registerTenant(app, "Motatto Test", "owner@test.com");
    await createProduct(app, s);
    await createProduct(app, s, { name: "Aceite 20W50", reference: "", category: "lubricantes", cost: 45000, price: 65000, initialStock: 6 });
  });

  it("parses 'cambio de aceite y filtro, bujía NS 200 a treinta y dos mil' into 2 items with prices", async () => {
    const res = await request(app)
      .post("/api/assistant")
      .set(bearer(s))
      .send({ text: "cambio de aceite y filtro, bujía NS 200 a treinta y dos mil" });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("crear_orden");
    expect(res.body.items).toHaveLength(2);
    const [svc, bujia] = res.body.items;
    expect(svc.type).toBe("servicio");
    expect(svc.serviceId).toBeDefined();
    expect(svc.matchedName).toBe("Cambio de aceite y filtro");
    expect(svc.unitPrice).toBe(10000);
    expect(bujia.type).toBe("repuesto");
    expect(bujia.productId).toBeDefined();
    expect(bujia.matchedName).toBe("Bujía central NS 200");
    expect(bujia.unitPrice).toBe(32000);
    expect(bujia.confidence).toBeGreaterThan(0.4);
    expect(res.body.unrecognized).toEqual([]);
    expect(res.body.answer).toContain("42.000");
  });

  it("answers price and stock questions and vehicle lookups", async () => {
    const price = await request(app).post("/api/assistant").set(bearer(s)).send({ text: "¿cuánto vale la bujía de NS 200?" });
    expect(price.body.intent).toBe("consultar_precio");
    expect(price.body.answer).toContain("32.000");
    expect(price.body.answer).toContain("4 en stock");
    const stock = await request(app).post("/api/assistant").set(bearer(s)).send({ text: "hay aceite 20w50?" });
    expect(stock.body.intent).toBe("consultar_stock");
    expect(stock.body.items[0].matchedName).toBe("Aceite 20W50");

    const { vehicleId } = await createCustomerVehicle(app, s, "ABC123");
    const v = await request(app).post("/api/assistant").set(bearer(s)).send({ text: "qué le hicimos a la placa ABC123" });
    expect(v.body.intent).toBe("buscar_vehiculo");
    expect(v.body.vehicle.id).toBe(vehicleId);
    expect(v.body.vehicle.plate).toBe("ABC123");

    const unk = await request(app).post("/api/assistant").set(bearer(s)).send({ text: "cambio de llanta trasera, aceite" });
    expect(unk.body.intent).toBe("crear_orden");
    expect(unk.body.items.length).toBe(2);
  });

  it("transcribe returns 501 when not configured", async () => {
    const res = await request(app).post("/api/assistant/transcribe").set(bearer(s)).attach("audio", Buffer.from("abc"), { filename: "a.webm", contentType: "audio/webm" });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_CONFIGURED");
  });

  it("read-label returns a note when AI is not configured", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const res = await request(app).post("/api/products/read-label").set(bearer(s)).attach("file", png, { filename: "l.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.confidence).toBe(0);
    expect(res.body.note).toBe("IA no configurada");
  });
});
