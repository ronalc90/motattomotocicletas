import { Router } from "express";
import { z } from "zod";
import { VehicleSchema } from "@motatto/shared";
import { requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { parseBody, parseQuery } from "../middleware/validate.js";
import { Customer, Order, Vehicle, type VehicleDoc } from "../models/index.js";
import { searchRegex } from "../lib/text.js";
import { conflict, notFound } from "../lib/errors.js";
import { listOrders } from "../services/orderService.js";

export const vehiclesRouter = Router();
vehiclesRouter.use(requireTenant);

const VehicleQuery = z.object({
  q: z.string().trim().max(100).optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

async function withCustomer(req: Parameters<typeof scope>[0], v: VehicleDoc) {
  const c = await Customer.findOne({ _id: v.customerId, ...scope(req) });
  return { ...v.toJSON(), customer: c ? { id: String(c._id), name: c.name, phone: c.phone } : undefined };
}

vehiclesRouter.get(
  "/",
  requirePermission("customers:read"),
  wrap(async (req, res) => {
    const q = parseQuery(VehicleQuery, req);
    const filter: Record<string, unknown> = { ...scope(req) };
    if (q.customerId) filter.customerId = q.customerId;
    if (q.q) {
      const rx = searchRegex(q.q);
      filter.$or = [{ plate: rx }, { brand: rx }, { model: rx }];
    }
    const [items, total] = await Promise.all([
      Vehicle.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Vehicle.countDocuments(filter),
    ]);
    const full = await Promise.all(items.map((v) => withCustomer(req, v)));
    res.json({ items: full, total, page: q.page, limit: q.limit });
  }),
);

vehiclesRouter.get(
  "/plate/:plate",
  requirePermission("customers:read"),
  wrap(async (req, res) => {
    const plate = String(req.params.plate).toUpperCase().replace(/\s+/g, "");
    const v = await Vehicle.findOne({ ...scope(req), plate });
    if (!v) throw notFound("Vehículo");
    res.json(await withCustomer(req, v));
  }),
);

vehiclesRouter.post(
  "/",
  requirePermission("customers:write"),
  wrap(async (req, res) => {
    const input = parseBody(VehicleSchema, req);
    const customer = await Customer.findOne({ _id: input.customerId, ...scope(req) });
    if (!customer) throw notFound("Cliente");
    if (input.plate && (await Vehicle.exists({ ...scope(req), plate: input.plate }))) {
      throw conflict("Ya existe un vehículo con esa placa", "PLATE_TAKEN");
    }
    const v = await Vehicle.create({ ...scope(req), ...input });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { vehicleIds: v._id } });
    res.status(201).json(await withCustomer(req, v));
  }),
);

vehiclesRouter.get(
  "/:id",
  requirePermission("customers:read"),
  wrap(async (req, res) => {
    const v = await Vehicle.findOne({ _id: req.params.id, ...scope(req) });
    if (!v) throw notFound("Vehículo");
    res.json(await withCustomer(req, v));
  }),
);

vehiclesRouter.patch(
  "/:id",
  requirePermission("customers:write"),
  wrap(async (req, res) => {
    const input = parseBody(VehicleSchema.partial(), req);
    const v = await Vehicle.findOne({ _id: req.params.id, ...scope(req) });
    if (!v) throw notFound("Vehículo");
    if (input.customerId && !(await Customer.exists({ _id: input.customerId, ...scope(req) }))) throw notFound("Cliente");
    if (input.plate && input.plate !== v.plate && (await Vehicle.exists({ ...scope(req), plate: input.plate }))) {
      throw conflict("Ya existe un vehículo con esa placa", "PLATE_TAKEN");
    }
    v.set(input);
    await v.save();
    res.json(await withCustomer(req, v));
  }),
);

vehiclesRouter.delete(
  "/:id",
  requirePermission("customers:write"),
  wrap(async (req, res) => {
    const v = await Vehicle.findOne({ _id: req.params.id, ...scope(req) });
    if (!v) throw notFound("Vehículo");
    if (await Order.exists({ ...scope(req), vehicleId: v._id })) {
      throw conflict("El vehículo tiene órdenes; no se puede eliminar", "HAS_ORDERS");
    }
    await v.deleteOne();
    await Customer.updateOne({ _id: v.customerId }, { $pull: { vehicleIds: v._id } });
    res.json({ ok: true, id: String(v._id) });
  }),
);

vehiclesRouter.get(
  "/:id/orders",
  requirePermission("orders:read"),
  wrap(async (req, res) => {
    const v = await Vehicle.findOne({ _id: req.params.id, ...scope(req) });
    if (!v) throw notFound("Vehículo");
    res.json(await listOrders(req, { vehicleId: String(v._id), page: 1, limit: 100 }));
  }),
);
