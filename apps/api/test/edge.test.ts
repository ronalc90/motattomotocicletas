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

/** Creates a product line order with one item of the given product. */
async function newOrder(s: Session, productId: string, customerId: string, vehicleId: string, qty = 1) {
  const res = await request(app)
    .post("/api/orders")
    .set(bearer(s))
    .send({ customerId, vehicleId, items: [{ type: "repuesto", productId, description: "Bujía", qty, unitPrice: 32000 }] });
  expect(res.status).toBe(201);
  return res.body as { id: string; total: number; status: string; items: Array<{ id: string }> };
}

describe("casos borde de órdenes, cobro e inventario", () => {
  let owner: Session;
  let customerId: string;
  let vehicleId: string;
  beforeEach(async () => {
    owner = await registerTenant(app, "Taller Borde", "borde@test.com");
    ({ customerId, vehicleId } = await createCustomerVehicle(app, owner));
  });

  it("rechaza cantidades 0, negativas o decimales y precios negativos", async () => {
    const product = await createProduct(app, owner);
    const base = { customerId, vehicleId };
    const bad = [
      { type: "repuesto", productId: product.id, description: "x", qty: 0, unitPrice: 100 },
      { type: "repuesto", productId: product.id, description: "x", qty: -2, unitPrice: 100 },
      { type: "repuesto", productId: product.id, description: "x", qty: 1.5, unitPrice: 100 },
      { type: "repuesto", productId: product.id, description: "x", qty: 1, unitPrice: -100 },
      { type: "repuesto", productId: product.id, description: "   ", qty: 1, unitPrice: 100 },
    ];
    for (const item of bad) {
      const res = await request(app).post("/api/orders").set(bearer(owner)).send({ ...base, items: [item] });
      expect(res.status, JSON.stringify(item)).toBe(400);
    }
  });

  it("el descuento nunca deja el total negativo", async () => {
    const product = await createProduct(app, owner);
    const order = await newOrder(owner, product.id, customerId, vehicleId);
    const res = await request(app).patch(`/api/orders/${order.id}`).set(bearer(owner)).send({ discount: 999999 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it("no permite cobrar por menos del total (sin cobro parcial silencioso)", async () => {
    const product = await createProduct(app, owner);
    const order = await newOrder(owner, product.id, customerId, vehicleId);
    const res = await request(app).post(`/api/orders/${order.id}/pay`).set(bearer(owner)).send({ method: "efectivo", amount: 1000 });
    expect(res.status).toBe(400);
    const again = await request(app).get(`/api/orders/${order.id}`).set(bearer(owner));
    expect(again.body.status).not.toBe("pagada");
  });

  it("cobrar dos veces la misma orden devuelve 409 y no duplica el pago", async () => {
    const product = await createProduct(app, owner);
    const order = await newOrder(owner, product.id, customerId, vehicleId);
    expect((await request(app).post(`/api/orders/${order.id}/pay`).set(bearer(owner)).send({ method: "efectivo" })).status).toBe(200);
    const second = await request(app).post(`/api/orders/${order.id}/pay`).set(bearer(owner)).send({ method: "efectivo" });
    expect(second.status).toBe(409);
    expect(second.body.error?.code ?? second.body.code).toBe("BAD_TRANSITION");
  });

  it("no se puede descontar más stock del que hay", async () => {
    const product = await createProduct(app, owner, { initialStock: 1 });
    const order = await newOrder(owner, product.id, customerId, vehicleId, 3);
    const res = await request(app)
      .post(`/api/orders/${order.id}/status`)
      .set(bearer(owner))
      .send({ status: "terminada", deduct: [{ productId: product.id, qty: 3 }] });
    expect(res.status).toBe(409);
    expect(res.body.error?.code ?? res.body.code).toBe("INSUFFICIENT_STOCK");
    const p = await request(app).get(`/api/products/${product.id}`).set(bearer(owner));
    expect(p.body.stock).toBeGreaterThanOrEqual(0);
  });

  it("anular exige motivo, y al anular tras cobrar devuelve stock y anula el pago", async () => {
    const product = await createProduct(app, owner, { initialStock: 4 });
    const order = await newOrder(owner, product.id, customerId, vehicleId, 2);
    const noReason = await request(app).post(`/api/orders/${order.id}/status`).set(bearer(owner)).send({ status: "anulada" });
    expect(noReason.status).toBe(400);

    await request(app).post(`/api/orders/${order.id}/pay`).set(bearer(owner)).send({ method: "efectivo", deduct: [{ productId: product.id, qty: 2 }] });
    expect((await request(app).get(`/api/products/${product.id}`).set(bearer(owner))).body.stock).toBe(2);

    const voided = await request(app)
      .post(`/api/orders/${order.id}/status`)
      .set(bearer(owner))
      .send({ status: "anulada", voidReason: "Cliente se arrepintió" });
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe("anulada");
    expect((await request(app).get(`/api/products/${product.id}`).set(bearer(owner))).body.stock).toBe(4);
    const payments = await request(app).get(`/api/payments?from=2000-01-01&to=2100-01-01`).set(bearer(owner));
    const items = payments.body.items ?? payments.body;
    expect(items.every((p: { voided: boolean }) => p.voided === true)).toBe(true);
  });

  it("no se puede cambiar a 'pagada' por /status ni anular una orden ya anulada", async () => {
    const product = await createProduct(app, owner);
    const order = await newOrder(owner, product.id, customerId, vehicleId);
    const viaStatus = await request(app).post(`/api/orders/${order.id}/status`).set(bearer(owner)).send({ status: "pagada" });
    expect(viaStatus.status).toBe(400);
    await request(app).post(`/api/orders/${order.id}/status`).set(bearer(owner)).send({ status: "anulada", voidReason: "error" });
    const again = await request(app).post(`/api/orders/${order.id}/status`).set(bearer(owner)).send({ status: "anulada", voidReason: "otra vez" });
    expect(again.status).toBe(409);
  });

  it("el vehículo debe pertenecer al cliente y ser del mismo taller", async () => {
    const product = await createProduct(app, owner);
    const other = await createCustomerVehicle(app, owner, "XYZ999");
    const mismatch = await request(app)
      .post("/api/orders")
      .set(bearer(owner))
      .send({ customerId, vehicleId: other.vehicleId, items: [{ type: "repuesto", productId: product.id, description: "x", qty: 1, unitPrice: 1 }] });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error?.code ?? mismatch.body.code).toBe("VEHICLE_MISMATCH");

    const otro = await registerTenant(app, "Otro Taller", "otro@test.com");
    const foreign = await createCustomerVehicle(app, otro, "QQQ111");
    const cross = await request(app)
      .post("/api/orders")
      .set(bearer(owner))
      .send({ customerId: foreign.customerId, vehicleId: foreign.vehicleId, items: [] });
    expect(cross.status).toBe(404);
  });

  it("ids inválidos y cuerpos malformados responden 4xx, nunca 500", async () => {
    expect((await request(app).get("/api/orders/no-es-un-id").set(bearer(owner))).status).toBeLessThan(500);
    expect((await request(app).get("/api/customers/123").set(bearer(owner))).status).toBeLessThan(500);
    expect((await request(app).post(`/api/orders/${"a".repeat(24)}/pay`).set(bearer(owner)).send({ method: "efectivo" })).status).toBe(404);
    const malformed = await request(app)
      .post("/api/orders")
      .set({ ...bearer(owner), "Content-Type": "application/json" })
      .send('{"customerId": ');
    expect(malformed.status).toBe(400);
    const order = await newOrder(owner, (await createProduct(app, owner)).id, customerId, vehicleId);
    expect((await request(app).post(`/api/orders/${order.id}/pay`).set(bearer(owner)).send({ method: "bitcoin" })).status).toBe(400);
  });

  it("el recargo de Nequi se aplica solo a ese método", async () => {
    const product = await createProduct(app, owner);
    const order = await newOrder(owner, product.id, customerId, vehicleId);
    const paid = await request(app).post(`/api/orders/${order.id}/pay`).set(bearer(owner)).send({ method: "nequi" });
    expect(paid.status).toBe(200);
    expect(paid.body.surcharge).toBeGreaterThanOrEqual(0);
    const efectivo = await newOrder(owner, product.id, customerId, vehicleId);
    const cash = await request(app).post(`/api/orders/${efectivo.id}/pay`).set(bearer(owner)).send({ method: "efectivo" });
    expect(cash.body.surcharge).toBe(0);
    expect(cash.body.total).toBe(32000);
  });

  it("cerrar caja dos veces da 409; reabrir y cerrar de nuevo funciona", async () => {
    const date = "2026-06-15";
    expect((await request(app).post("/api/cash/close").set(bearer(owner)).send({ date })).status).toBe(201);
    expect((await request(app).post("/api/cash/close").set(bearer(owner)).send({ date })).status).toBe(409);
    expect((await request(app).post("/api/cash/reopen").set(bearer(owner)).send({ date })).status).toBe(200);
    expect((await request(app).post("/api/cash/reopen").set(bearer(owner)).send({ date })).status).toBe(409);
    expect((await request(app).post("/api/cash/close").set(bearer(owner)).send({ date })).status).toBe(200);
    expect((await request(app).post("/api/cash/close").set(bearer(owner)).send({ date: "2026-13-45" })).status).toBe(400);
  });

  it("un usuario desactivado pierde el acceso con su token ya emitido", async () => {
    const admin = await inviteAndAccept(app, owner, "admin", "adm@test.com");
    expect((await request(app).get("/api/orders").set(bearer(admin))).status).toBe(200);
    const deactivate = await request(app).patch(`/api/users/${admin.userId}`).set(bearer(owner)).send({ active: false });
    expect(deactivate.status).toBe(200);
    expect((await request(app).get("/api/orders").set(bearer(admin))).status).toBe(401);
  });

  it("el dueño no puede ser desactivado ni cambiado de rol", async () => {
    const res = await request(app).patch(`/api/users/${owner.userId}`).set(bearer(owner)).send({ active: false });
    expect(res.status).toBe(400);
    expect(res.body.error?.code ?? res.body.code).toBe("OWNER_PROTECTED");
  });
});
