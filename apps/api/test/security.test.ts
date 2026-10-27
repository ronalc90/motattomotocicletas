import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import pino from "pino";
import { bearer, clearDb, createCustomerVehicle, createProduct, inviteAndAccept, registerTenant, startDb, stopDb, type Session } from "./setup.js";
import { Order } from "../src/models/index.js";
import * as loggerModule from "../src/lib/logger.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

/** Clave del link público que devuelve la API autenticada para una orden. */
async function publicKey(s: Session, orderId: string): Promise<{ url: URL; key: string }> {
  const inv = await request(app).get(`/api/orders/${orderId}/invoice`).set(bearer(s));
  expect(inv.status).toBe(200);
  const url = new URL(inv.body.publicUrl);
  return { url, key: url.searchParams.get("k") ?? "" };
}

describe("link público de la cuenta de cobro", () => {
  let s: Session;
  beforeEach(async () => {
    s = await registerTenant(app, "Taller Seguro", "seguro@test.com");
  });

  async function newOrder(plate: string) {
    const { customerId, vehicleId } = await createCustomerVehicle(app, s, plate);
    const o = await request(app)
      .post("/api/orders")
      .set(bearer(s))
      .send({ customerId, vehicleId, items: [{ type: "servicio", description: "Revisión", qty: 1, unitPrice: 50000 }] });
    expect(o.status).toBe(201);
    return o.body as { id: string; number: string };
  }

  it("no se puede abrir solo con el slug y el número consecutivo", async () => {
    const o = await newOrder("AAA111");
    const { url, key } = await publicKey(s, o.id);
    expect(url.pathname).toBe(`/cc/${s.slug}/${o.number}`);
    expect(key).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const base = `/api/public/invoices/${s.slug}/${o.number}`;
    // Sin clave, con una clave equivocada o con operadores de Mongo en la query: 404.
    for (const qs of ["", "?k=", "?k=AAAAAAAAAAAAAAAAAAAAAAAA", "?k[$ne]=x", "?k[$exists]=true", "?k[$regex]=.*", `?k=${key}&k=${key}`]) {
      expect((await request(app).get(`${base}${qs}`)).status, `json ${qs}`).toBe(404);
      expect((await request(app).get(`${base}/pdf${qs}`)).status, `pdf ${qs}`).toBe(404);
    }

    const ok = await request(app).get(`${base}?k=${key}`);
    expect(ok.status).toBe(200);
    expect(ok.body.number).toBe(o.number);
    expect(JSON.stringify(ok.body)).not.toContain(key);
    const pdf = await request(app).get(`${base}/pdf?k=${key}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");

    // La clave de una orden no abre la siguiente (que sería la adivinable).
    const o2 = await newOrder("BBB222");
    expect((await request(app).get(`/api/public/invoices/${s.slug}/${o2.number}?k=${key}`)).status).toBe(404);
    const k2 = (await publicKey(s, o2.id)).key;
    expect(k2).not.toBe(key);
    expect((await request(app).get(`/api/public/invoices/${s.slug}/${o2.number}?k=${k2}`)).status).toBe(200);
  });

  it("una orden antigua sin clave recibe una estable al pedir su factura", async () => {
    const o = await newOrder("CCC333");
    await Order.updateOne({ _id: o.id }, { $unset: { publicToken: 1 } });
    expect((await request(app).get(`/api/public/invoices/${s.slug}/${o.number}`)).status).toBe(404);

    const k1 = (await publicKey(s, o.id)).key;
    const k2 = (await publicKey(s, o.id)).key;
    expect(k1).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(k2).toBe(k1);
    expect((await request(app).get(`/api/public/invoices/${s.slug}/${o.number}?k=${k1}`)).status).toBe(200);
  });

  it("los endpoints públicos tienen límite de peticiones", async () => {
    const r = await request(app).get(`/api/public/tenants/${s.slug}`);
    expect(r.status).toBe(200);
    expect(r.headers["ratelimit-limit"]).toBeDefined();
  });
});

describe("logs HTTP", () => {
  it("no guardan el JWT (cabecera ni ?token=) ni el token de seed", async () => {
    const httpLogger = (loggerModule as Record<string, unknown>).httpLogger as ((l: pino.Logger) => express.RequestHandler) | undefined;
    expect(typeof httpLogger).toBe("function");
    const lines: string[] = [];
    const log = pino({ level: "info" }, { write: (line: string) => void lines.push(line) });
    const mini = express();
    mini.use(httpLogger!(log));
    mini.get("/api/files/x", (req, res) => res.json({ auth: req.headers.authorization ?? null, token: req.query.token ?? null }));

    const jwt = "eyJhbGciOiJIUzI1NiJ9.sesion-secreta-123.firma";
    const r = await request(mini)
      .get(`/api/files/x?page=2&token=${jwt}`)
      .set("Authorization", `Bearer ${jwt}`)
      .set("X-Seed-Token", "semilla-secreta-456");
    // La petición sigue llegando intacta a la app.
    expect(r.body).toEqual({ auth: `Bearer ${jwt}`, token: jwt });
    await new Promise((done) => setImmediate(done));

    const out = lines.join("\n");
    expect(out).toContain("/api/files/x?page=2");
    expect(out).not.toContain("sesion-secreta-123");
    expect(out).not.toContain("semilla-secreta-456");
  });
});

describe("permisos que la API debe aplicar (no solo la interfaz)", () => {
  let owner: Session;
  let mecanico: Session;
  beforeEach(async () => {
    owner = await registerTenant(app, "Taller Roles", "roles@test.com");
    mecanico = await inviteAndAccept(app, owner, "mecanico", "mecanico@test.com");
  });

  it("el panel no le muestra costos ni dinero de caja al mecánico", async () => {
    await createProduct(app, owner, { initialStock: 1, minStock: 3 });
    const mine = await request(app).get("/api/dashboard").set(bearer(mecanico));
    expect(mine.status).toBe(200);
    expect(mine.body.lowStock).toHaveLength(1);
    expect(mine.body.lowStock[0].cost).toBeUndefined();
    expect(mine.body.today.sales).toBeUndefined();
    expect(mine.body.today.payments).toBeUndefined();
    expect(mine.body.today.expenses).toBeUndefined();
    expect(mine.body.month.sales).toBeUndefined();
    expect(mine.body.today.ordersPaid).toBe(0);

    const own = await request(app).get("/api/dashboard").set(bearer(owner));
    expect(own.body.lowStock[0].cost).toBe(18000);
    expect(own.body.today.sales).toBe(0);
    expect(own.body.month.sales).toBe(0);
  });

  it("el mecánico no ve ni cambia costos por los movimientos, ni registra gastos", async () => {
    const p = await createProduct(app, owner);
    const detail = await request(app).get(`/api/products/${p.id}`).set(bearer(mecanico));
    expect(detail.status).toBe(200);
    expect(detail.body.movements.length).toBeGreaterThan(0);
    expect(detail.body.movements[0].unitCost).toBeUndefined();

    const mv = await request(app)
      .post(`/api/products/${p.id}/movements`)
      .set(bearer(mecanico))
      .send({ type: "entrada", qty: 2, unitCost: 999999, registerExpense: true });
    expect(mv.status).toBe(201);
    expect(mv.body.stock).toBe(6);
    expect(mv.body.movement.unitCost).toBeUndefined();
    expect(mv.body.expense).toBeUndefined();

    const after = await request(app).get(`/api/products/${p.id}`).set(bearer(owner));
    expect(after.body.cost).toBe(18000);
    expect(after.body.movements[0].unitCost).toBe(18000);
    const expenses = await request(app).get("/api/expenses").set(bearer(owner));
    expect(expenses.body.items).toEqual([]);

    // El dueño sí puede registrar la compra con su costo y como gasto.
    const ownMv = await request(app)
      .post(`/api/products/${p.id}/movements`)
      .set(bearer(owner))
      .send({ type: "entrada", qty: 1, unitCost: 20000, registerExpense: true });
    expect(ownMv.body.cost).toBe(20000);
    expect(ownMv.body.expense.amount).toBe(20000);
  });

  it("el mecánico no pone precio a líneas libres de la orden", async () => {
    const { customerId, vehicleId } = await createCustomerVehicle(app, owner);
    const o = await request(app)
      .post("/api/orders")
      .set(bearer(mecanico))
      .send({ customerId, vehicleId, items: [{ type: "otro", description: "Mano de obra", qty: 1, unitPrice: 500000 }] });
    expect(o.status).toBe(201);
    expect(o.body.items[0].unitPrice).toBe(0);
    expect(o.body.total).toBe(0);

    // El dueño fija el precio de esa línea.
    const lineId = o.body.items[0].id as string;
    const priced = await request(app)
      .patch(`/api/orders/${o.body.id}`)
      .set(bearer(owner))
      .send({ items: [{ id: lineId, type: "otro", description: "Mano de obra", qty: 1, unitPrice: 40000 }] });
    expect(priced.body.items[0].unitPrice).toBe(40000);

    // El mecánico edita la orden: conserva el precio existente y las líneas nuevas quedan en 0.
    const edited = await request(app)
      .patch(`/api/orders/${o.body.id}`)
      .set(bearer(mecanico))
      .send({
        items: [
          { id: lineId, type: "otro", description: "Mano de obra", qty: 1, unitPrice: 1 },
          { type: "repuesto", description: "Repuesto sin catálogo", qty: 1, unitPrice: 900000 },
        ],
      });
    expect(edited.status).toBe(200);
    expect(edited.body.items[0].unitPrice).toBe(40000);
    expect(edited.body.items[1].unitPrice).toBe(0);
    expect(edited.body.total).toBe(40000);
  });
});
