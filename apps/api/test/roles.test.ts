import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bearer, clearDb, createCustomerVehicle, createProduct, inviteAndAccept, registerTenant, startDb, stopDb, type Session } from "./setup.js";

/**
 * Matriz de roles: para cada rol y cada endpoint protegido, comprueba que
 * el permiso se aplica (403 cuando no tiene permiso, <500 y distinto de 403 cuando sí).
 */
let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

type Role = "dueno" | "admin" | "mecanico" | "cajero" | "contador";

describe("matriz de roles", () => {
  let s: Record<Role, Session>;
  let product: any;
  let customerId: string;
  let vehicleId: string;

  beforeEach(async () => {
    const owner = await registerTenant(app, "Taller Roles", "dueno@roles.test");
    s = {
      dueno: owner,
      admin: await inviteAndAccept(app, owner, "admin", "admin@roles.test"),
      mecanico: await inviteAndAccept(app, owner, "mecanico", "mec@roles.test"),
      cajero: await inviteAndAccept(app, owner, "cajero", "caj@roles.test"),
      contador: await inviteAndAccept(app, owner, "contador", "cont@roles.test"),
    };
    product = await createProduct(app, owner);
    ({ customerId, vehicleId } = await createCustomerVehicle(app, owner));
  });

  /** expected: roles that MUST be allowed. Everyone else must get 403. */
  async function check(label: string, allowed: Role[], call: (sess: Session) => Promise<{ status: number; body?: any }>) {
    for (const role of Object.keys(s) as Role[]) {
      const r = await call(s[role]);
      const ok = allowed.includes(role);
      if (ok) {
        expect([label, role, r.status], `${label} debe permitir a ${role}`).not.toEqual([label, role, 403]);
        expect(r.status, `${label} ${role} error de servidor`).toBeLessThan(500);
      } else {
        expect([label, role, r.status], `${label} debe negar a ${role}`).toEqual([label, role, 403]);
      }
    }
  }

  it("lectura de inventario, clientes, órdenes y dashboard: todos los roles", async () => {
    await check("GET /products", ["dueno", "admin", "mecanico", "cajero", "contador"], (x) => request(app).get("/api/products").set(bearer(x)));
    await check("GET /customers", ["dueno", "admin", "mecanico", "cajero", "contador"], (x) => request(app).get("/api/customers").set(bearer(x)));
    await check("GET /orders", ["dueno", "admin", "mecanico", "cajero", "contador"], (x) => request(app).get("/api/orders").set(bearer(x)));
    await check("GET /dashboard", ["dueno", "admin", "mecanico", "cajero", "contador"], (x) => request(app).get("/api/dashboard").set(bearer(x)));
  });

  it("costos de inventario: solo dueño, admin y contador", async () => {
    for (const role of ["dueno", "admin", "contador"] as Role[]) {
      const r = await request(app).get(`/api/products/${product.id}`).set(bearer(s[role]));
      expect(r.body.cost, role).toBe(18000);
    }
    for (const role of ["mecanico", "cajero"] as Role[]) {
      const r = await request(app).get(`/api/products/${product.id}`).set(bearer(s[role]));
      expect(r.body.cost, role).toBeUndefined();
    }
  });

  it("entrada de inventario: dueño, admin, mecánico (no cajero ni contador)", async () => {
    await check("POST /products (entrada)", ["dueno", "admin", "mecanico"], (x) =>
      request(app).post("/api/products").set(bearer(x)).send({ name: "Pastilla freno", category: "frenos", cost: 1000, price: 2000, stock: 0, minStock: 1, initialStock: 0 }),
    );
  });

  it("ajuste de stock y borrado de producto: solo dueño y admin", async () => {
    await check("POST /products/:id/adjust", ["dueno", "admin"], (x) =>
      request(app).post(`/api/products/${product.id}/adjust`).set(bearer(x)).send({ countedQty: 3 }),
    );
    await check("DELETE /products/:id", ["dueno", "admin"], (x) => request(app).delete(`/api/products/${product.id}`).set(bearer(x)));
  });

  it("órdenes: crear (dueño, admin, mecánico, cajero) y anular (dueño, admin)", async () => {
    await check("POST /orders", ["dueno", "admin", "mecanico", "cajero"], (x) =>
      request(app).post("/api/orders").set(bearer(x)).send({ customerId, vehicleId, items: [] }),
    );
    await check("POST /orders/:id/status anulada", ["dueno", "admin"], async (x) => {
      // orden fresca por rol: anular cambia el estado y contaminaría la siguiente comprobación
      const o = await request(app).post("/api/orders").set(bearer(s.dueno)).send({ customerId, vehicleId, items: [{ type: "servicio", description: "Cambio aceite", qty: 1, unitPrice: 20000 }] });
      return request(app).post(`/api/orders/${o.body.id}/status`).set(bearer(x)).send({ status: "anulada", voidReason: "prueba" });
    });
  });

  it("finalizar orden: dueño, admin, mecánico", async () => {
    await check("POST /orders/:id/status terminada", ["dueno", "admin", "mecanico"], async (x) => {
      const o = await request(app).post("/api/orders").set(bearer(s.dueno)).send({ customerId, vehicleId, items: [{ type: "servicio", description: "Revisión", qty: 1, unitPrice: 10000 }] });
      return request(app).post(`/api/orders/${o.body.id}/status`).set(bearer(x)).send({ status: "terminada" });
    });
  });

  it("cobro de orden: dueño, admin, cajero (no mecánico ni contador)", async () => {
    await check("POST /orders/:id/pay", ["dueno", "admin", "cajero"], async (x) => {
      const o = await request(app).post("/api/orders").set(bearer(s.dueno)).send({ customerId, vehicleId, items: [{ type: "servicio", description: "Cobro", qty: 1, unitPrice: 10000 }] });
      await request(app).post(`/api/orders/${o.body.id}/status`).set(bearer(s.dueno)).send({ status: "terminada" });
      return request(app).post(`/api/orders/${o.body.id}/pay`).set(bearer(x)).send({ method: "efectivo" });
    });
  });

  it("caja: lectura (dueño, admin, cajero, contador); cierre (dueño, admin, cajero); reabrir (dueño, admin)", async () => {
    await check("GET /cash/day", ["dueno", "admin", "cajero", "contador"], (x) => request(app).get("/api/cash/day").set(bearer(x)));
    await check("POST /cash/close", ["dueno", "admin", "cajero"], (x) => request(app).post("/api/cash/close").set(bearer(x)).send({ date: "2026-10-16" }));
    await check("POST /cash/reopen", ["dueno", "admin"], (x) => request(app).post("/api/cash/reopen").set(bearer(x)).send({ date: "2026-10-16" }));
  });

  it("gastos: lectura (dueño, admin, cajero, contador); alta (dueño, admin, cajero)", async () => {
    await check("GET /expenses", ["dueno", "admin", "cajero", "contador"], (x) => request(app).get("/api/expenses").set(bearer(x)));
    await check("POST /expenses", ["dueno", "admin", "cajero"], (x) =>
      request(app).post("/api/expenses").set(bearer(x)).send({ concept: "Almuerzo", category: "otro", amount: 15000 }),
    );
  });

  it("reportes y Excel: dueño, admin, contador", async () => {
    const q = "?from=2026-01-01&to=2026-12-31";
    await check("GET /reports/sales", ["dueno", "admin", "contador"], (x) => request(app).get(`/api/reports/sales${q}`).set(bearer(x)));
    await check("GET /reports/sales/export", ["dueno", "admin", "contador"], (x) => request(app).get(`/api/reports/sales/export${q}`).set(bearer(x)));
  });

  it("servicios (catálogo): lectura todos; gestión dueño y admin", async () => {
    await check("GET /services", ["dueno", "admin", "mecanico", "cajero", "contador"], (x) => request(app).get("/api/services").set(bearer(x)));
    await check("POST /services", ["dueno", "admin"], (x) =>
      request(app).post("/api/services").set(bearer(x)).send({ name: "Revisión general", category: "General", suggestedPrice: 50000, active: true }),
    );
  });

  it("clientes: alta (dueño, admin, mecánico, cajero), no contador", async () => {
    await check("POST /customers", ["dueno", "admin", "mecanico", "cajero"], (x) =>
      request(app).post("/api/customers").set(bearer(x)).send({ name: "Cliente Nuevo", phone: "3001112233" }),
    );
  });

  it("configuración del taller y auditoría: dueño y admin", async () => {
    await check("PATCH /tenant", ["dueno", "admin"], (x) => request(app).patch("/api/tenant").set(bearer(x)).send({ slogan: "Calidad" }));
    await check("GET /audit", ["dueno", "admin"], (x) => request(app).get("/api/audit").set(bearer(x)));
  });

  it("usuarios: gestionar (dueño, admin); invitar un admin o mecánico", async () => {
    await check("GET /users", ["dueno", "admin"], (x) => request(app).get("/api/users").set(bearer(x)));
    await check("POST /users/invite", ["dueno", "admin"], (x) =>
      request(app).post("/api/users/invite").set(bearer(x)).send({ name: "Nuevo Mec", email: `n${Math.random().toString(36).slice(2)}@roles.test`, role: "mecanico" }),
    );
  });

  it("superadmin: solo superadmin (cualquier rol de taller recibe 403)", async () => {
    await check("GET /superadmin/tenants", [], (x) => request(app).get("/api/superadmin/tenants").set(bearer(x)));
  });

  it("aislamiento entre talleres: un dueño de otro taller no ve nada", async () => {
    const otro = await registerTenant(app, "Otro Taller", "otro@roles.test", "carros");
    const r1 = await request(app).get(`/api/orders`).set(bearer(otro));
    expect(r1.body.items?.length ?? r1.body.length ?? 0).toBe(0);
    expect((await request(app).get(`/api/products/${product.id}`).set(bearer(otro))).status).toBe(404);
    expect((await request(app).get(`/api/customers`).set(bearer(otro))).body.items?.length ?? 0).toBe(0);
  });
});
