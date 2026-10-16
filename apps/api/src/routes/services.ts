import { Router } from "express";
import { ServiceSchema } from "@motatto/shared";
import { requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { Service } from "../models/index.js";
import { notFound } from "../lib/errors.js";
import { audit } from "../lib/audit.js";

export const servicesRouter = Router();
servicesRouter.use(requireTenant);

servicesRouter.get(
  "/",
  wrap(async (req, res) => {
    const all = req.query.includeInactive ? {} : { active: true };
    const items = await Service.find({ ...scope(req), ...all }).sort({ category: 1, name: 1 });
    res.json({ items: items.map((s) => s.toJSON()), total: items.length, page: 1, limit: items.length });
  }),
);

servicesRouter.post(
  "/",
  requirePermission("services:manage"),
  wrap(async (req, res) => {
    const input = parseBody(ServiceSchema, req);
    const s = await Service.create({ ...scope(req), ...input });
    res.status(201).json(s.toJSON());
  }),
);

servicesRouter.patch(
  "/:id",
  requirePermission("services:manage"),
  wrap(async (req, res) => {
    const input = parseBody(ServiceSchema.partial(), req);
    const s = await Service.findOne({ _id: req.params.id, ...scope(req) });
    if (!s) throw notFound("Servicio");
    const before = s.toJSON();
    s.set(input);
    await s.save();
    if (before.suggestedPrice !== s.suggestedPrice) {
      await audit(req, "service.price_change", "service", s._id, { suggestedPrice: before.suggestedPrice }, { suggestedPrice: s.suggestedPrice });
    }
    res.json(s.toJSON());
  }),
);

servicesRouter.delete(
  "/:id",
  requirePermission("services:manage"),
  wrap(async (req, res) => {
    const s = await Service.findOneAndUpdate({ _id: req.params.id, ...scope(req) }, { active: false }, { new: true });
    if (!s) throw notFound("Servicio");
    res.json(s.toJSON());
  }),
);
