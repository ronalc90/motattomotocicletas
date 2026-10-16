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

describe("multitenant isolation", () => {
  let a: Session;
  let b: Session;
  beforeEach(async () => {
    a = await registerTenant(app, "Taller A", "a@test.com");
    b = await registerTenant(app, "Taller B", "b@test.com");
  });

  it("registers tenants with unique slugs and seeded services", async () => {
    const c = await registerTenant(app, "Taller A", "c@test.com");
    expect(c.slug).not.toBe(a.slug);
    const services = await request(app).get("/api/services").set(bearer(a));
    expect(services.status).toBe(200);
    expect(services.body.items.length).toBeGreaterThan(5);
  });

  it("rejects duplicate emails globally", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ tenantName: "Otro", type: "carros", ownerName: "Xavier", email: "a@test.com", password: "secret123" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("B cannot read, update or list A's data", async () => {
    const product = await createProduct(app, a);
    const { customerId, vehicleId } = await createCustomerVehicle(app, a);
    const order = await request(app)
      .post("/api/orders")
      .set(bearer(a))
      .send({ customerId, vehicleId, items: [{ type: "repuesto", productId: product.id, description: "Bujía", qty: 1, unitPrice: 32000 }] });
    expect(order.status).toBe(201);
    expect(order.body.number).toMatch(/^TA-\d{4}-0001$/);

    // reads
    expect((await request(app).get(`/api/products/${product.id}`).set(bearer(b))).status).toBe(404);
    expect((await request(app).get(`/api/customers/${customerId}`).set(bearer(b))).status).toBe(404);
    expect((await request(app).get(`/api/vehicles/${vehicleId}`).set(bearer(b))).status).toBe(404);
    expect((await request(app).get(`/api/orders/${order.body.id}`).set(bearer(b))).status).toBe(404);
    expect((await request(app).get(`/api/orders/${order.body.id}/invoice`).set(bearer(b))).status).toBe(404);
    // updates
    expect((await request(app).patch(`/api/products/${product.id}`).set(bearer(b)).send({ price: 1 })).status).toBe(404);
    expect((await request(app).patch(`/api/customers/${customerId}`).set(bearer(b)).send({ name: "Hack" })).status).toBe(404);
    expect((await request(app).patch(`/api/orders/${order.body.id}`).set(bearer(b)).send({ discount: 1000 })).status).toBe(404);
    expect((await request(app).post(`/api/orders/${order.body.id}/pay`).set(bearer(b)).send({ method: "efectivo" })).status).toBe(404);
    expect((await request(app).post(`/api/products/${product.id}/adjust`).set(bearer(b)).send({ countedQty: 0 })).status).toBe(404);
    // lists
    for (const path of ["/api/products", "/api/customers", "/api/vehicles", "/api/orders", "/api/payments"]) {
      const res = await request(app).get(path).set(bearer(b));
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
    }
    // B cannot use A's product in an order
    const cv = await createCustomerVehicle(app, b, "XYZ789");
    const bad = await request(app)
      .post("/api/orders")
      .set(bearer(b))
      .send({ customerId: cv.customerId, vehicleId: cv.vehicleId, items: [{ type: "repuesto", productId: product.id, description: "x", qty: 1, unitPrice: 1 }] });
    expect(bad.status).toBe(404);
    // A still sees its own
    const mine = await request(app).get("/api/products").set(bearer(a));
    expect(mine.body.total).toBe(1);
    // untouched
    const p = await request(app).get(`/api/products/${product.id}`).set(bearer(a));
    expect(p.body.price).toBe(32000);
    expect(p.body.stock).toBe(4);
  });

  it("requires auth and rejects bad tokens", async () => {
    expect((await request(app).get("/api/products")).status).toBe(401);
    expect((await request(app).get("/api/products").set("Authorization", "Bearer nope")).status).toBe(401);
    const me = await request(app).get("/api/auth/me").set(bearer(a));
    expect(me.status).toBe(200);
    expect(me.body.user.passwordHash).toBeUndefined();
    expect(me.body.tenant.id).toBe(a.tenantId);
  });
});
