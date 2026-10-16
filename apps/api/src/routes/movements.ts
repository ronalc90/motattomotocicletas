import { Router } from "express";
import { z } from "zod";
import { MOVEMENT_TYPES } from "@motatto/shared";
import { hasPerm, requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { parseQuery } from "../middleware/validate.js";
import { Product, StockMovement, User } from "../models/index.js";
import { rangeOf } from "../lib/dates.js";

export const movementsRouter = Router();
movementsRouter.use(requireTenant, requirePermission("inventory:read"));

const Query = z.object({
  productId: z.string().optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

movementsRouter.get(
  "/",
  wrap(async (req, res) => {
    const q = parseQuery(Query, req);
    const filter: Record<string, unknown> = { ...scope(req) };
    if (q.productId) filter.productId = q.productId;
    if (q.type) filter.type = q.type;
    if (q.from || q.to) {
      const r = rangeOf(q.from ?? "2000-01-01", q.to ?? "2100-01-01");
      filter.createdAt = { $gte: r.start, $lt: r.end };
    }
    const [items, total] = await Promise.all([
      StockMovement.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
      StockMovement.countDocuments(filter),
    ]);
    const pids = [...new Set(items.map((m) => String(m.productId)))];
    const uids = [...new Set(items.map((m) => String(m.userId)))];
    const [products, users] = await Promise.all([
      Product.find({ ...scope(req), _id: { $in: pids } }).select("name reference"),
      User.find({ _id: { $in: uids } }).select("name"),
    ]);
    const pm = new Map(products.map((p) => [String(p._id), p]));
    const um = new Map(users.map((u) => [String(u._id), u]));
    const showCost = hasPerm(req, "inventory:cost");
    res.json({
      items: items.map((m) => {
        const j = m.toJSON() as unknown as Record<string, unknown>;
        if (!showCost) delete j.unitCost;
        const p = pm.get(String(m.productId));
        const u = um.get(String(m.userId));
        return {
          ...j,
          product: p ? { id: String(p._id), name: p.name, reference: p.reference } : undefined,
          user: u ? { id: String(u._id), name: u.name } : undefined,
        };
      }),
      total,
      page: q.page,
      limit: q.limit,
    });
  }),
);
