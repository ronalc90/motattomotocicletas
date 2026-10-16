import { Router } from "express";
import { SuperadminUpdateTenantSchema } from "@motatto/shared";
import { auth, requireRole, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { Order, Product, Tenant, User } from "../models/index.js";
import { monthStart } from "../lib/dates.js";
import { searchRegex } from "../lib/text.js";
import { AppError, notFound } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { signToken } from "../lib/jwt.js";
import { config } from "../config.js";
import { runSeed } from "../services/seedService.js";

export const superadminRouter = Router();

// Seed endpoint protected by SEED_TOKEN header (no JWT required).
superadminRouter.post(
  "/seed-demo",
  wrap(async (req, res) => {
    const token = req.header("X-Seed-Token") ?? req.header("x-seed-token");
    if (!config.seedToken || token !== config.seedToken) throw new AppError(403, "FORBIDDEN", "Token de seed inválido");
    res.json(await runSeed());
  }),
);

superadminRouter.use(auth, requireRole("superadmin"));

async function usageOf(tenantId: unknown) {
  const [usersCount, productsCount, ordersThisMonth, ordersTotal] = await Promise.all([
    User.countDocuments({ tenantId, active: true }),
    Product.countDocuments({ tenantId, active: true }),
    Order.countDocuments({ tenantId, createdAt: { $gte: monthStart() } }),
    Order.countDocuments({ tenantId }),
  ]);
  return { usersCount, productsCount, ordersThisMonth, ordersTotal };
}

superadminRouter.get(
  "/tenants",
  wrap(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter: Record<string, unknown> = {};
    if (q) {
      const rx = searchRegex(q);
      filter.$or = [{ name: rx }, { slug: rx }, { email: rx }, { city: rx }];
    }
    const tenants = await Tenant.find(filter).sort({ createdAt: -1 }).limit(500);
    const items = await Promise.all(tenants.map(async (t) => ({ ...t.toJSON(), usage: await usageOf(t._id) })));
    res.json({ items, total: items.length, page: 1, limit: items.length });
  }),
);

superadminRouter.get(
  "/stats",
  wrap(async (_req, res) => {
    const [tenants, active, ordersTotal, ordersThisMonth, users] = await Promise.all([
      Tenant.countDocuments({}),
      Tenant.countDocuments({ status: "activo" }),
      Order.countDocuments({}),
      Order.countDocuments({ createdAt: { $gte: monthStart() } }),
      User.countDocuments({ role: { $ne: "superadmin" }, active: true }),
    ]);
    res.json({ tenants, active, ordersTotal, ordersThisMonth, users });
  }),
);

superadminRouter.get(
  "/tenants/:id",
  wrap(async (req, res) => {
    const t = await Tenant.findById(req.params.id);
    if (!t) throw notFound("Taller");
    const users = await User.find({ tenantId: t._id }).select("name email role active lastLoginAt createdAt");
    res.json({ ...t.toJSON(), usage: await usageOf(t._id), users: users.map((u) => u.toJSON()) });
  }),
);

superadminRouter.patch(
  "/tenants/:id",
  wrap(async (req, res) => {
    const input = parseBody(SuperadminUpdateTenantSchema, req);
    const t = await Tenant.findById(req.params.id);
    if (!t) throw notFound("Taller");
    const before = { plan: t.plan, status: t.status };
    if (input.plan) t.plan = input.plan;
    if (input.status) t.status = input.status;
    await t.save();
    req.tenantId = t._id;
    await audit(req, "superadmin.tenant_update", "tenant", t._id, before, { plan: t.plan, status: t.status });
    res.json({ ...t.toJSON(), usage: await usageOf(t._id) });
  }),
);

superadminRouter.post(
  "/tenants/:id/impersonate",
  wrap(async (req, res) => {
    const t = await Tenant.findById(req.params.id);
    if (!t) throw notFound("Taller");
    const token = signToken({ sub: String(req.user!._id), tenantId: String(t._id), role: "dueno", imp: true }, "4h");
    req.tenantId = t._id;
    await audit(req, "superadmin.impersonate", "tenant", t._id, undefined, { slug: t.slug });
    res.json({ token, tenant: t.toJSON() });
  }),
);
