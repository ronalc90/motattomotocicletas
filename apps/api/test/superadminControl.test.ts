import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import bcrypt from "bcryptjs";
import { bearer, clearDb, createCustomerVehicle, createProduct, inviteAndAccept, registerTenant, startDb, stopDb, type Session } from "./setup.js";
import { User, Tenant, Product } from "../src/models/index.js";

let app: Express;
beforeAll(async () => {
  app = await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

describe("control del superadmin: usuarios, métricas y purga", () => {
  let owner: Session;
  let staff: Session;
  let sa: { Authorization: string };

  beforeEach(async () => {
    owner = await registerTenant(app, "Taller Control", "control@test.com");
    staff = await inviteAndAccept(app, owner, "mecanico", "mec-control@test.com");
    await User.create({ tenantId: null, name: "SA", email: "sa-control@test.com", passwordHash: await bcrypt.hash("secret123", 4), role: "superadmin", active: true });
    const login = await request(app).post("/api/auth/login").send({ email: "sa-control@test.com", password: "secret123" });
    sa = { Authorization: `Bearer ${login.body.token}` };
  });

  it("solo el superadmin accede a las rutas nuevas (dueño y personal reciben 403, sin token 401)", async () => {
    for (const path of ["/api/superadmin/users", "/api/superadmin/metrics"]) {
      expect((await request(app).get(path).set(bearer(owner))).status, path).toBe(403);
      expect((await request(app).get(path).set(bearer(staff))).status, path).toBe(403);
      expect((await request(app).get(path)).status, path).toBe(401);
    }
    expect((await request(app).patch(`/api/superadmin/users/${owner.userId}`).set(bearer(staff)).send({ active: false })).status).toBe(403);
    expect((await request(app).delete(`/api/superadmin/tenants/${owner.tenantId}`).set(bearer(owner)).send({ confirm: "control" })).status).toBe(403);
  });

  it("lista dueños y personal de todos los talleres, con filtros y búsqueda", async () => {
    const all = await request(app).get("/api/superadmin/users").set(sa);
    expect(all.status).toBe(200);
    const emails = all.body.items.map((u: { email: string }) => u.email);
    expect(emails).toEqual(expect.arrayContaining(["control@test.com", "mec-control@test.com"]));
    expect(emails).not.toContain("sa-control@test.com");
    expect(all.body.items[0]).not.toHaveProperty("passwordHash");

    const owners = await request(app).get("/api/superadmin/users?kind=owner").set(sa);
    expect(owners.body.items.every((u: { role: string }) => u.role === "dueno")).toBe(true);
    const staffOnly = await request(app).get("/api/superadmin/users?kind=staff").set(sa);
    expect(staffOnly.body.items.every((u: { role: string }) => u.role !== "dueno")).toBe(true);

    const search = await request(app).get("/api/superadmin/users?q=mec-control").set(sa);
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0].tenant.name).toBe("Taller Control");
  });

  it("edita nombre, rol y estado de un usuario, con auditoría", async () => {
    const res = await request(app).patch(`/api/superadmin/users/${staff.userId}`).set(sa).send({ name: "Nuevo Nombre", role: "cajero", active: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nuevo Nombre");
    expect(res.body.role).toBe("cajero");
    expect(res.body.active).toBe(false);
    // Desactivado: su token ya no sirve.
    expect((await request(app).get("/api/orders").set(bearer(staff))).status).toBe(401);
  });

  it("no permite cambiar al dueño a otro rol, ni tocar a otro superadmin", async () => {
    const toOwnerRole = await request(app).patch(`/api/superadmin/users/${owner.userId}`).set(sa).send({ role: "admin" });
    expect(toOwnerRole.status).toBe(400);
    const sa2 = await User.findOne({ email: "sa-control@test.com" });
    const other = await request(app).patch(`/api/superadmin/users/${sa2!._id}`).set(sa).send({ active: false });
    expect(other.status).toBe(404);
  });

  it("métricas: series de 6 meses, usuarios por rol, órdenes por estado y planes", async () => {
    const res = await request(app).get("/api/superadmin/metrics").set(sa);
    expect(res.status).toBe(200);
    expect(res.body.series).toHaveLength(6);
    expect(res.body.series[5]).toEqual(expect.objectContaining({ tenants: expect.any(Number), orders: expect.any(Number), revenue: expect.any(Number) }));
    const roles = res.body.usersByRole.map((r: { role: string }) => r.role);
    expect(roles).toEqual(expect.arrayContaining(["dueno", "mecanico"]));
    expect(roles).not.toContain("superadmin");
    expect(res.body.plans.length).toBeGreaterThan(0);
  });

  it("purga: rechaza slug incorrecto y no borra nada", async () => {
    await createProduct(app, owner);
    const bad = await request(app).delete(`/api/superadmin/tenants/${owner.tenantId}`).set(sa).send({ confirm: "otro-slug" });
    expect(bad.status).toBe(400);
    expect(bad.body.error?.code ?? bad.body.code).toBe("CONFIRM_MISMATCH");
    expect(await Tenant.findById(owner.tenantId)).not.toBeNull();
    expect(await Product.countDocuments({ tenantId: owner.tenantId })).toBe(1);
  });

  it("purga: con el slug exacto borra el taller, sus datos y sus usuarios; no toca otros talleres", async () => {
    const other = await registerTenant(app, "Taller Vecino", "vecino@test.com");
    await createProduct(app, owner);
    await createCustomerVehicle(app, owner);
    await createProduct(app, other);

    const res = await request(app).delete(`/api/superadmin/tenants/${owner.tenantId}`).set(sa).send({ confirm: owner.slug });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    expect(await Tenant.findById(owner.tenantId)).toBeNull();
    expect(await Product.countDocuments({ tenantId: owner.tenantId })).toBe(0);
    expect(await User.countDocuments({ tenantId: owner.tenantId })).toBe(0);
    expect(await Tenant.findById(other.tenantId)).not.toBeNull();
    expect(await Product.countDocuments({ tenantId: other.tenantId })).toBe(1);
    expect((await request(app).get("/api/auth/me").set(bearer(owner))).status).toBe(401);
  });
});
