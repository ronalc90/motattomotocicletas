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

describe("order flow", () => {
  let s: Session;
  beforeEach(async () => {
    s = await registerTenant(app, "Motatto Test", "owner@test.com");
  });

  it("create → terminada (deduct once) → pay nequi +3% → invoice → void restores stock", async () => {
    const product = await createProduct(app, s); // stock 4, price 32000
    const services = (await request(app).get("/api/services").set(bearer(s))).body.items as Array<{ id: string; name: string; suggestedPrice: number }>;
    const oil = services.find((x) => x.name === "Cambio de aceite y filtro")!;
    const { customerId, vehicleId } = await createCustomerVehicle(app, s);

    const created = await request(app)
      .post("/api/orders")
      .set(bearer(s))
      .send({
        customerId,
        vehicleId,
        km: 12000,
        description: "Revisión",
        items: [
          { type: "repuesto", productId: product.id, description: "Bujía central NS 200", qty: 2, unitPrice: 32000 },
          { type: "servicio", serviceId: oil.id, description: oil.name, qty: 1, unitPrice: 10000 },
        ],
      });
    expect(created.status).toBe(201);
    const order = created.body;
    expect(order.status).toBe("recibida");
    expect(order.subtotal).toBe(74000);
    expect(order.total).toBe(74000);
    expect(order.items[0].description).toBe("Bujía central NS 200");
    expect(order.items[0].unitCost).toBe(18000);
    expect(order.items[0].id).toBeDefined();
    expect(order.customer.name).toBe("Cliente Test");

    // preview
    const preview = await request(app).get(`/api/orders/${order.id}/deduct-preview`).set(bearer(s));
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual([{ productId: product.id, name: "Bujía central NS 200", qty: 2, stock: 4, after: 2 }]);

    // en_proceso → terminada with deduct
    expect((await request(app).post(`/api/orders/${order.id}/status`).set(bearer(s)).send({ status: "en_proceso" })).status).toBe(200);
    const done = await request(app)
      .post(`/api/orders/${order.id}/status`)
      .set(bearer(s))
      .send({ status: "terminada", deduct: [{ productId: product.id, qty: 2 }] });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("terminada");
    expect(done.body.stockDeducted).toHaveLength(1);
    let p = (await request(app).get(`/api/products/${product.id}`).set(bearer(s))).body;
    expect(p.stock).toBe(2);
    expect(p.movements[0].type).toBe("salida");
    expect(p.movements[0].qty).toBe(-2);

    // preview now empty; deducting again is a no-op
    expect((await request(app).get(`/api/orders/${order.id}/deduct-preview`).set(bearer(s))).body).toEqual([]);
    const paid = await request(app)
      .post(`/api/orders/${order.id}/pay`)
      .set(bearer(s))
      .send({ method: "nequi", deduct: [{ productId: product.id, qty: 2 }] });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe("pagada");
    expect(paid.body.surchargeMethod).toBe("nequi");
    expect(paid.body.surcharge).toBe(2220); // 3% of 74000
    expect(paid.body.total).toBe(76220);
    expect(paid.body.paidAt).toBeDefined();
    expect(paid.body.warrantyUntil).toBeDefined();
    expect(paid.body.payments).toHaveLength(1);
    expect(paid.body.payments[0].amount).toBe(76220);
    expect(paid.body.payments[0].method).toBe("nequi");
    p = (await request(app).get(`/api/products/${product.id}`).set(bearer(s))).body;
    expect(p.stock).toBe(2); // not deducted twice

    // locked
    const edit = await request(app).patch(`/api/orders/${order.id}`).set(bearer(s)).send({ description: "x" });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe("ORDER_LOCKED");

    // invoice
    const inv = await request(app).get(`/api/orders/${order.id}/invoice`).set(bearer(s));
    expect(inv.status).toBe(200);
    expect(inv.body.text).toContain("TOTAL: 76.220");
    expect(inv.body.text).toContain("Recargo Nequi (3%)");
    expect(inv.body.text).toContain("Bujía central NS 200 x2");
    expect(inv.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/573214229804\?text=/);
    expect(inv.body.publicUrl).toBe(`http://web.test/cc/${s.slug}/${order.number}`);
    expect(inv.body.invoice.items[0].unitCost).toBeUndefined();

    // cash day shows the payment
    const day = await request(app).get("/api/cash/day").set(bearer(s));
    expect(day.status).toBe(200);
    expect(day.body.totals.nequi).toBe(76220);
    expect(day.body.totals.surcharges).toBe(2220);

    // dashboard & report
    const dash = await request(app).get("/api/dashboard").set(bearer(s));
    expect(dash.status).toBe(200);
    expect(dash.body.today.ordersPaid).toBe(1);
    const today = day.body.date;
    const rep = await request(app).get(`/api/reports/sales?from=${today}&to=${today}`).set(bearer(s));
    expect(rep.status).toBe(200);
    expect(rep.body.totalSales).toBe(76220);
    expect(rep.body.totalCost).toBe(36000);
    expect(rep.body.profit).toBe(40220);
    expect(rep.body.topProducts[0].qty).toBe(2);
    const xlsx = await request(app).get(`/api/reports/sales/export?from=${today}&to=${today}`).set(bearer(s));
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers["content-type"]).toContain("spreadsheetml");

    // void without reason → 400
    const noReason = await request(app).post(`/api/orders/${order.id}/status`).set(bearer(s)).send({ status: "anulada" });
    expect(noReason.status).toBe(400);
    const voided = await request(app)
      .post(`/api/orders/${order.id}/status`)
      .set(bearer(s))
      .send({ status: "anulada", voidReason: "Error de digitación" });
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe("anulada");
    expect(voided.body.payments[0].voided).toBe(true);
    p = (await request(app).get(`/api/products/${product.id}`).set(bearer(s))).body;
    expect(p.stock).toBe(4);
    expect(p.movements[0].type).toBe("devolucion");

    const audit = await request(app).get("/api/audit").set(bearer(s));
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(["order.pay", "order.void"]));
  });

  it("numbers orders sequentially and rejects bad transitions", async () => {
    const { customerId, vehicleId } = await createCustomerVehicle(app, s);
    const o1 = await request(app).post("/api/orders").set(bearer(s)).send({ customerId, vehicleId });
    const o2 = await request(app).post("/api/orders").set(bearer(s)).send({ customerId, vehicleId });
    expect(o1.body.number.endsWith("-0001")).toBe(true);
    expect(o2.body.number.endsWith("-0002")).toBe(true);
    const bad = await request(app).post(`/api/orders/${o1.body.id}/status`).set(bearer(s)).send({ status: "pagada" });
    expect(bad.status).toBe(400);
    const cot = await request(app).post(`/api/orders/${o1.body.id}/status`).set(bearer(s)).send({ status: "cotizada" });
    expect(cot.body.status).toBe("cotizada");
    const list = await request(app).get("/api/orders?status=cotizada").set(bearer(s));
    expect(list.body.total).toBe(1);
  });

  it("closes and reopens the cash day", async () => {
    const { customerId, vehicleId } = await createCustomerVehicle(app, s);
    const o = await request(app)
      .post("/api/orders")
      .set(bearer(s))
      .send({ customerId, vehicleId, items: [{ type: "otro", description: "Lavado", qty: 1, unitPrice: 20000 }] });
    await request(app).post(`/api/orders/${o.body.id}/pay`).set(bearer(s)).send({ method: "efectivo" });
    const exp = await request(app).post("/api/expenses").set(bearer(s)).send({ concept: "Almuerzo", category: "otro", amount: 15000 });
    expect(exp.status).toBe(201);
    const close = await request(app).post("/api/cash/close").set(bearer(s)).send({});
    expect(close.status).toBe(201);
    expect(close.body.totals.efectivo).toBe(20000);
    expect(close.body.totals.expenses).toBe(15000);
    expect(close.body.totals.net).toBe(5000);
    const again = await request(app).post("/api/cash/close").set(bearer(s)).send({});
    expect(again.status).toBe(409);
    const day = await request(app).get("/api/cash/day").set(bearer(s));
    expect(day.body.payments[0].closingId).toBe(close.body.id);
    const reopen = await request(app).post("/api/cash/reopen").set(bearer(s)).send({ date: close.body.date });
    expect(reopen.status).toBe(200);
    expect(reopen.body.reopened).toBe(true);
    expect((await request(app).post("/api/cash/close").set(bearer(s)).send({})).status).toBe(200);
  });
});
