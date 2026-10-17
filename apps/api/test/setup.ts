import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.OPENAI_API_KEY = "";
process.env.SUPERADMIN_EMAIL = "superadmin@motatto.app";
process.env.SUPERADMIN_PASSWORD = "Motatto2026!";
process.env.SEED_OWNER_PASSWORD = "Motatto2026!";
process.env.WEB_URL = "http://web.test";

let mongod: MongoMemoryServer | null = null;
let app: Express | null = null;

export async function startDb(): Promise<Express> {
  if (!mongod) {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
  if (!app) {
    const { createApp } = await import("../src/app.js");
    app = createApp();
  }
  return app;
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  mongod = null;
  app = null;
}

export async function clearDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export interface Session {
  token: string;
  tenantId: string;
  userId: string;
  slug: string;
}

export async function registerTenant(app: Express, name: string, email: string, type = "motos"): Promise<Session> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ tenantName: name, type, ownerName: "Owner", email, password: "secret123", city: "Bogotá", phone: "3001234567" });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, tenantId: res.body.tenant.id, userId: res.body.user.id, slug: res.body.tenant.slug };
}

export const bearer = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

export async function createCustomerVehicle(app: Express, s: Session, plate = "ABC123") {
  const c = await request(app).post("/api/customers").set(bearer(s)).send({ name: "Cliente Test", phone: "3214229804" });
  if (c.status !== 201) throw new Error(`customer failed ${JSON.stringify(c.body)}`);
  const v = await request(app)
    .post("/api/vehicles")
    .set(bearer(s))
    .send({ customerId: c.body.id, kind: "moto", brand: "Suzuki", model: "Gixxer 250", plate });
  if (v.status !== 201) throw new Error(`vehicle failed ${JSON.stringify(v.body)}`);
  return { customerId: c.body.id as string, vehicleId: v.body.id as string };
}

export async function createProduct(app: Express, s: Session, data: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/products")
    .set(bearer(s))
    .send({ name: "Bujía central NS 200", reference: "JG351209", brand: "Bajaj", category: "bujias", compatibleWith: ["NS 200"], cost: 18000, price: 32000, minStock: 2, initialStock: 4, ...data });
  if (res.status !== 201) throw new Error(`product failed ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Invite a user with the given role and accept the invitation; returns a session for that user. */
export async function inviteAndAccept(app: Express, owner: Session, role: string, email: string): Promise<Session> {
  const inv = await request(app).post("/api/users/invite").set(bearer(owner)).send({ name: `User ${role}`, email, role });
  if (inv.status !== 201) throw new Error(`invite failed ${JSON.stringify(inv.body)}`);
  const token = (inv.body.inviteUrl as string).split("/invitacion/")[1];
  const acc = await request(app).post("/api/auth/invite/accept").send({ token, password: "secret123" });
  if (acc.status !== 200) throw new Error(`accept failed ${JSON.stringify(acc.body)}`);
  return { token: acc.body.token, tenantId: acc.body.tenant.id, userId: acc.body.user.id, slug: acc.body.tenant.slug };
}
