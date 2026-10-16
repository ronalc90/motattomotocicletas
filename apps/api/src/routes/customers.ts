import { Router } from "express";
import { CustomerSchema, ListQuerySchema } from "@motatto/shared";
import { requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { parseBody, parseQuery } from "../middleware/validate.js";
import { Customer, Order, Vehicle } from "../models/index.js";
import { searchRegex } from "../lib/text.js";
import { notFound } from "../lib/errors.js";
import { listOrders } from "../services/orderService.js";

export const customersRouter = Router();
customersRouter.use(requireTenant);

customersRouter.get(
  "/",
  requirePermission("customers:read"),
  wrap(async (req, res) => {
    const q = parseQuery(ListQuerySchema, req);
    const filter: Record<string, unknown> = { ...scope(req) };
    if (q.q) {
      const rx = searchRegex(q.q);
      filter.$or = [{ name: rx }, { phone: rx }, { document: rx }];
    }
    const [items, total] = await Promise.all([
      Customer.find(filter)
        .sort({ name: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Customer.countDocuments(filter),
    ]);
    res.json({ items: items.map((c) => c.toJSON()), total, page: q.page, limit: q.limit });
  }),
);

customersRouter.post(
  "/",
  requirePermission("customers:write"),
  wrap(async (req, res) => {
    const input = parseBody(CustomerSchema, req);
    const c = await Customer.create({ ...scope(req), ...input });
    res.status(201).json(c.toJSON());
  }),
);

customersRouter.get(
  "/:id",
  requirePermission("customers:read"),
  wrap(async (req, res) => {
    const c = await Customer.findOne({ _id: req.params.id, ...scope(req) });
    if (!c) throw notFound("Cliente");
    const vehicles = await Vehicle.find({ ...scope(req), customerId: c._id }).sort({ createdAt: 1 });
    res.json({ ...c.toJSON(), vehicles: vehicles.map((v) => v.toJSON()) });
  }),
);

customersRouter.patch(
  "/:id",
  requirePermission("customers:write"),
  wrap(async (req, res) => {
    const input = parseBody(CustomerSchema.partial(), req);
    const c = await Customer.findOneAndUpdate({ _id: req.params.id, ...scope(req) }, { $set: input }, { new: true });
    if (!c) throw notFound("Cliente");
    res.json(c.toJSON());
  }),
);

customersRouter.delete(
  "/:id",
  requirePermission("customers:write"),
  wrap(async (req, res) => {
    const c = await Customer.findOne({ _id: req.params.id, ...scope(req) });
    if (!c) throw notFound("Cliente");
    const hasOrders = await Order.exists({ ...scope(req), customerId: c._id });
    if (hasOrders) {
      res.status(409).json({ error: { code: "HAS_ORDERS", message: "El cliente tiene órdenes; no se puede eliminar" } });
      return;
    }
    await Vehicle.deleteMany({ ...scope(req), customerId: c._id });
    await c.deleteOne();
    res.json({ ok: true, id: String(c._id) });
  }),
);

customersRouter.get(
  "/:id/orders",
  requirePermission("orders:read"),
  wrap(async (req, res) => {
    const c = await Customer.findOne({ _id: req.params.id, ...scope(req) });
    if (!c) throw notFound("Cliente");
    res.json(await listOrders(req, { customerId: String(c._id), page: 1, limit: 100 }));
  }),
);
