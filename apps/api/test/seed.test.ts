import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { clearDb, startDb, stopDb } from "./setup.js";
import { runSeed } from "../src/services/seedService.js";
import { Order, Payment, Product } from "../src/models/index.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("seed", () => {
  it("is idempotent and creates the sample paid order", async () => {
    const r1 = await runSeed();
    expect(r1.created.products).toBe(7);
    expect(r1.created.order).toMatch(/^MT-\d{4}-0001$/);
    const r2 = await runSeed();
    expect(r2.created).toEqual({ products: 0, services: 0 });
    expect(await Order.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1);
    const order = (await Order.findOne())!;
    expect(order.total).toBe(716000);
    expect(order.items).toHaveLength(12);
    expect(order.status).toBe("pagada");
    expect((await Product.findOne({ name: "Kit arrastre Gixxer 250" }))!.stock).toBe(0);

    const login = await request(app).post("/api/auth/login").send({ email: "dirox7@gmail.com", password: "Motatto2026!" });
    expect(login.status).toBe(200);
    expect(login.body.tenant.slug).toBe("motatto");
    // La orden del seed no tiene clave: se le asigna al pedir su factura con sesión.
    const inv = await request(app).get(`/api/orders/${order.id}/invoice`).set("Authorization", `Bearer ${login.body.token}`);
    const k = new URL(inv.body.publicUrl).searchParams.get("k");
    const pub = await request(app).get(`/api/public/invoices/motatto/${order.number}?k=${k}`);
    expect(pub.body.total).toBe(716000);
    expect(pub.body.tenant.paymentInfo).toBe("Nequi 321 422 9804");

    const sa = await request(app).post("/api/auth/login").send({ email: "superadmin@motatto.app", password: "Motatto2026!" });
    expect(sa.body.user.role).toBe("superadmin");
  });

  it("seed-demo endpoint requires SEED_TOKEN", async () => {
    const { config } = await import("../src/config.js");
    expect((await request(app).post("/api/superadmin/seed-demo")).status).toBe(403);
    config.seedToken = "tok";
    const res = await request(app).post("/api/superadmin/seed-demo").set("X-Seed-Token", "tok");
    expect(res.status).toBe(200);
    expect(res.body.tenant).toBe("motatto");
    config.seedToken = "";
  });
});
