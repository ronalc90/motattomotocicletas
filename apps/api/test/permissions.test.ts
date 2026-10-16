import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bearer, clearDb, createCustomerVehicle, createProduct, inviteAndAccept, registerTenant, startDb, stopDb, type Session } from "./setup.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("permissions", () => {
  let owner: Session;
  let mecanico: Session;
  let contador: Session;
  let cajero: Session;
  beforeEach(async () => {
    owner = await registerTenant(app, "Motatto Test", "owner@test.com");
    mecanico = await inviteAndAccept(app, owner, "mecanico", "mec@test.com");
    contador = await inviteAndAccept(app, owner, "contador", "cont@test.com");
    cajero = await inviteAndAccept(app, owner, "cajero", "caj@test.com");
  });

  it("invite preview works and expired/unknown tokens are rejected", async () => {
    const inv = await request(app).post("/api/users/invite").set(bearer(owner)).send({ name: "Ana", email: "ana@test.com", role: "admin" });
    expect(inv.status).toBe(201);
    const token = inv.body.inviteUrl.split("/invitacion/")[1];
    const preview = await request(app).get(`/api/auth/invite/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ name: "Ana", email: "ana@test.com", role: "admin", tenantName: "Motatto Test" });
    expect((await request(app).get("/api/auth/invite/nope-nope-nope")).status).toBe(404);
    // inactive until accepted
    const login = await request(app).post("/api/auth/login").send({ email: "ana@test.com", password: "whatever1" });
    expect(login.status).toBe(401);
  });

  it("mecanico cannot pay, contador cannot create orders, cajero cannot manage inventory", async () => {
    const product = await createProduct(app, owner);
    const { customerId, vehicleId } = await createCustomerVehicle(app, owner);
    const order = await request(app)
      .post("/api/orders")
      .set(bearer(mecanico))
      .send({ customerId, vehicleId, discount: 5000, items: [{ type: "repuesto", productId: product.id, description: "Bujía", qty: 1, unitPrice: 1000 }] });
    expect(order.status).toBe(201);
    // mecanico cannot change price nor discount: forced to catalog price / 0
    expect(order.body.items[0].unitPrice).toBe(32000);
    expect(order.body.discount).toBe(0);
    // mecanico does not see costs
    expect(order.body.items[0].unitCost).toBeUndefined();
    const prodView = await request(app).get(`/api/products/${product.id}`).set(bearer(mecanico));
    expect(prodView.body.cost).toBeUndefined();

    const pay = await request(app).post(`/api/orders/${order.body.id}/pay`).set(bearer(mecanico)).send({ method: "efectivo" });
    expect(pay.status).toBe(403);

    const contOrder = await request(app).post("/api/orders").set(bearer(contador)).send({ customerId, vehicleId });
    expect(contOrder.status).toBe(403);
    expect((await request(app).get("/api/orders").set(bearer(contador))).status).toBe(200);
    expect((await request(app).get("/api/reports/sales?from=2026-01-01&to=2026-12-31").set(bearer(contador))).status).toBe(200);

    expect((await request(app).post(`/api/products/${product.id}/adjust`).set(bearer(cajero)).send({ countedQty: 1 })).status).toBe(403);
    expect((await request(app).get("/api/reports/sales?from=2026-01-01&to=2026-12-31").set(bearer(cajero))).status).toBe(403);
    expect((await request(app).get("/api/users").set(bearer(mecanico))).status).toBe(403);
    // mecanico can finish; cajero can pay with price override
    const fin = await request(app).post(`/api/orders/${order.body.id}/status`).set(bearer(mecanico)).send({ status: "terminada" });
    expect(fin.status).toBe(200);
    const paid = await request(app).post(`/api/orders/${order.body.id}/pay`).set(bearer(cajero)).send({ method: "efectivo" });
    expect(paid.status).toBe(200);
    // mecanico cannot void
    const v = await request(app).post(`/api/orders/${order.body.id}/status`).set(bearer(mecanico)).send({ status: "anulada", voidReason: "x" });
    expect(v.status).toBe(403);
  });

  it("superadmin lists tenants, impersonates and suspended tenants are blocked", async () => {
    const { User } = await import("../src/models/index.js");
    const bcrypt = (await import("bcryptjs")).default;
    await User.create({ tenantId: null, name: "SA", email: "sa@test.com", passwordHash: await bcrypt.hash("secret123", 4), role: "superadmin", active: true });
    const login = await request(app).post("/api/auth/login").send({ email: "sa@test.com", password: "secret123" });
    expect(login.status).toBe(200);
    const sa = { Authorization: `Bearer ${login.body.token}` };
    const list = await request(app).get("/api/superadmin/tenants").set(sa);
    expect(list.status).toBe(200);
    expect(list.body.items[0].usage.usersCount).toBe(4);
    expect((await request(app).get("/api/superadmin/stats").set(sa)).body.tenants).toBe(1);
    expect((await request(app).get("/api/superadmin/tenants").set(bearer(owner))).status).toBe(403);

    const imp = await request(app).post(`/api/superadmin/tenants/${owner.tenantId}/impersonate`).set(sa);
    expect(imp.status).toBe(200);
    const asOwner = await request(app).get("/api/products").set("Authorization", `Bearer ${imp.body.token}`);
    expect(asOwner.status).toBe(200);

    const susp = await request(app).patch(`/api/superadmin/tenants/${owner.tenantId}`).set(sa).send({ status: "suspendido" });
    expect(susp.body.status).toBe("suspendido");
    const blocked = await request(app).get("/api/products").set(bearer(owner));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("TENANT_SUSPENDED");
    expect((await request(app).get("/api/auth/me").set(bearer(owner))).status).toBe(200);
    expect((await request(app).get("/api/tenant").set(bearer(owner))).status).toBe(200);
  });
});
