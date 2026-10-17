import { Router } from "express";
import { SuperadminUpdateTenantSchema } from "@motatto/shared";
import { auth, requireRole, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { AiUsage, Order, Product, Tenant, User } from "../models/index.js";
import { currentMonth } from "../lib/aiUsage.js";
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
    const before = { plan: t.plan, status: t.status, aiCallsLimit: t.aiCallsLimit };
    if (input.plan) t.plan = input.plan;
    if (input.status) t.status = input.status;
    if (input.aiCallsLimit !== undefined) t.aiCallsLimit = input.aiCallsLimit;
    await t.save();
    req.tenantId = t._id;
    await audit(req, "superadmin.tenant_update", "tenant", t._id, before, { plan: t.plan, status: t.status, aiCallsLimit: t.aiCallsLimit });
    res.json({ ...t.toJSON(), usage: await usageOf(t._id) });
  }),
);

function monthsBack(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(currentMonth(new Date(now.getFullYear(), now.getMonth() - i, 15)));
  return out;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Uso de IA de todos los talleres para un mes ("YYYY-MM", por defecto el actual). */
superadminRouter.get(
  "/ai-usage",
  wrap(async (req, res) => {
    const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : currentMonth();
    const [tenants, rows] = await Promise.all([
      Tenant.find({}).select("name slug plan status aiCallsLimit").lean(),
      AiUsage.find({ month }).lean(),
    ]);
    const byTenant = new Map(rows.map((r) => [String(r.tenantId), r]));
    const items = tenants
      .map((t) => {
        const u = byTenant.get(String(t._id));
        const calls = u?.calls ?? 0;
        const limit = t.aiCallsLimit ?? 300;
        return {
          tenantId: String(t._id),
          name: t.name,
          slug: t.slug,
          plan: t.plan,
          status: t.status,
          limit,
          calls,
          pct: limit ? Math.round((calls / limit) * 100) : 0,
          promptTokens: u?.promptTokens ?? 0,
          completionTokens: u?.completionTokens ?? 0,
          transcriptions: u?.transcriptions ?? 0,
          audioSeconds: u?.audioSeconds ?? 0,
          costUsd: r4(u?.costUsd ?? 0),
        };
      })
      .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
    const totals = items.reduce(
      (acc, i) => ({
        calls: acc.calls + i.calls,
        promptTokens: acc.promptTokens + i.promptTokens,
        completionTokens: acc.completionTokens + i.completionTokens,
        transcriptions: acc.transcriptions + i.transcriptions,
        costUsd: acc.costUsd + i.costUsd,
        tenantsOverLimit: acc.tenantsOverLimit + (i.calls >= i.limit ? 1 : 0),
        tenantsActive: acc.tenantsActive + (i.calls > 0 ? 1 : 0),
      }),
      { calls: 0, promptTokens: 0, completionTokens: 0, transcriptions: 0, costUsd: 0, tenantsOverLimit: 0, tenantsActive: 0 },
    );
    res.json({ month, totals: { ...totals, costUsd: r4(totals.costUsd) }, items });
  }),
);

/** Serie de los últimos 6 meses de un taller. */
superadminRouter.get(
  "/tenants/:id/ai-usage",
  wrap(async (req, res) => {
    const t = await Tenant.findById(req.params.id).select("aiCallsLimit name").lean();
    if (!t) throw notFound("Taller");
    const months = monthsBack(6);
    const rows = await AiUsage.find({ tenantId: t._id, month: { $in: months } }).lean();
    const byMonth = new Map(rows.map((r) => [r.month, r]));
    res.json({
      limit: t.aiCallsLimit ?? 300,
      series: months.map((m) => {
        const r = byMonth.get(m);
        return { month: m, calls: r?.calls ?? 0, transcriptions: r?.transcriptions ?? 0, costUsd: r4(r?.costUsd ?? 0) };
      }),
    });
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
