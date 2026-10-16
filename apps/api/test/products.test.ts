import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bearer, clearDb, createProduct, registerTenant, startDb, stopDb, type Session } from "./setup.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("products", () => {
  let s: Session;
  beforeEach(async () => {
    s = await registerTenant(app, "Motatto Test", "owner@test.com");
  });

  it("movements, adjust, low stock, search, import/export", async () => {
    const p = await createProduct(app, s);
    const entry = await request(app)
      .post(`/api/products/${p.id}/movements`)
      .set(bearer(s))
      .send({ type: "entrada", qty: 3, unitCost: 19000, supplier: "Bajaj", registerExpense: true });
    expect(entry.status).toBe(201);
    expect(entry.body.stock).toBe(7);
    expect(entry.body.expense.amount).toBe(57000);
    expect(entry.body.expense.category).toBe("repuestos");

    const adj = await request(app).post(`/api/products/${p.id}/adjust`).set(bearer(s)).send({ countedQty: 2, note: "conteo" });
    expect(adj.body.stock).toBe(2);
    expect(adj.body.delta).toBe(-5);
    const low = await request(app).get("/api/products/low-stock").set(bearer(s));
    expect(low.body.items.map((x: { id: string }) => x.id)).toContain(p.id);
    expect((await request(app).get("/api/products?lowStock=1").set(bearer(s))).body.total).toBe(1);

    expect((await request(app).get("/api/products?q=ns 200").set(bearer(s))).body.total).toBe(1);
    expect((await request(app).get("/api/products?q=JG3512").set(bearer(s))).body.total).toBe(1);
    expect((await request(app).get("/api/products?q=bajaj").set(bearer(s))).body.total).toBe(1);
    expect((await request(app).get("/api/products?q=zzz").set(bearer(s))).body.total).toBe(0);

    const csv = "nombre,referencia,codigo,marca,categoria,compatible,costo,precio,stock,stock_minimo,ubicacion\nFiltro de aceite,FA1,,Honda,filtros,\"CB 160, CB 190\",9000,16000,5,2,E1\nBujía central NS 200,JG351209,,Bajaj,bujias,NS 200,18000,33000,10,2,A1\n,,,\n";
    const imp = await request(app).post("/api/products/import").set(bearer(s)).attach("file", Buffer.from(csv), { filename: "inv.csv", contentType: "text/csv" });
    expect(imp.status).toBe(200);
    expect(imp.body.created).toBe(1);
    expect(imp.body.updated).toBe(1);
    const after = (await request(app).get(`/api/products/${p.id}`).set(bearer(s))).body;
    expect(after.price).toBe(33000);
    expect(after.stock).toBe(10);
    const filtro = (await request(app).get("/api/products?q=filtro").set(bearer(s))).body.items[0];
    expect(filtro.compatibleWith).toEqual(["CB 160", "CB 190"]);

    const xlsx = await request(app).get("/api/products/export").set(bearer(s));
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers["content-type"]).toContain("spreadsheetml");

    const del = await request(app).delete(`/api/products/${p.id}`).set(bearer(s));
    expect(del.body.active).toBe(false);
    expect((await request(app).get("/api/products").set(bearer(s))).body.total).toBe(1);
    const movs = await request(app).get(`/api/movements?productId=${p.id}`).set(bearer(s));
    expect(movs.body.items.length).toBe(4);
    expect(movs.body.items[0].product.name).toBe("Bujía central NS 200");
  });
});
