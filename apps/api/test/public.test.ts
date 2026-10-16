import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bearer, clearDb, createCustomerVehicle, createProduct, registerTenant, startDb, stopDb, type Session } from "./setup.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("public invoice", () => {
  let s: Session;
  beforeEach(async () => {
    s = await registerTenant(app, "Motatto Test", "owner@test.com");
  });

  it("serves JSON and PDF without auth, hides costs", async () => {
    const product = await createProduct(app, s);
    const { customerId, vehicleId } = await createCustomerVehicle(app, s);
    const o = await request(app)
      .post("/api/orders")
      .set(bearer(s))
      .send({ customerId, vehicleId, internalNotes: "secreto", items: [{ type: "repuesto", productId: product.id, description: "Bujía", qty: 1, unitPrice: 32000 }] });
    await request(app).post(`/api/orders/${o.body.id}/pay`).set(bearer(s)).send({ method: "efectivo" });

    const pub = await request(app).get(`/api/public/invoices/${s.slug}/${o.body.number}`);
    expect(pub.status).toBe(200);
    expect(pub.body.number).toBe(o.body.number);
    expect(pub.body.status).toBe("pagada");
    expect(pub.body.total).toBe(32000);
    expect(pub.body.tenant.name).toBe("Motatto Test");
    expect(pub.body.customer.name).toBe("Cliente Test");
    expect(JSON.stringify(pub.body)).not.toContain("secreto");
    expect(JSON.stringify(pub.body)).not.toContain("unitCost");
    expect(pub.body.warrantyUntil).toBeDefined();

    const pdf = await request(app).get(`/api/public/invoices/${s.slug}/${o.body.number}/pdf`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    expect((pdf.body as Buffer).length).toBeGreaterThan(1000);

    const authPdf = await request(app).get(`/api/orders/${o.body.id}/pdf`).set(bearer(s));
    expect(authPdf.headers["content-type"]).toBe("application/pdf");

    expect((await request(app).get(`/api/public/invoices/${s.slug}/NOPE-2026-9999`)).status).toBe(404);
    expect((await request(app).get(`/api/public/invoices/otro-taller/${o.body.number}`)).status).toBe(404);
    const t = await request(app).get(`/api/public/tenants/${s.slug}`);
    expect(t.status).toBe(200);
    expect(t.body.name).toBe("Motatto Test");

    // voided orders still resolve with status anulada
    await request(app).post(`/api/orders/${o.body.id}/status`).set(bearer(s)).send({ status: "anulada", voidReason: "prueba" });
    const voided = await request(app).get(`/api/public/invoices/${s.slug}/${o.body.number}`);
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe("anulada");
  });
});
