import { Router } from "express";
import { UpdateTenantSchema } from "@motatto/shared";
import { requirePermission, requireTenant, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { Order, Product, Tenant, User } from "../models/index.js";
import { imageUpload, storeFile } from "../services/storage.js";
import { monthStart } from "../lib/dates.js";
import { audit } from "../lib/audit.js";
import { badRequest } from "../lib/errors.js";

export const tenantRouter = Router();

export async function refreshUsage(tenantId: unknown) {
  const [usersCount, productsCount, ordersThisMonth] = await Promise.all([
    User.countDocuments({ tenantId, active: true }),
    Product.countDocuments({ tenantId, active: true }),
    Order.countDocuments({ tenantId, createdAt: { $gte: monthStart() } }),
  ]);
  return Tenant.findByIdAndUpdate(tenantId, { usage: { usersCount, productsCount, ordersThisMonth } }, { new: true });
}

tenantRouter.get(
  "/",
  requireTenant,
  wrap(async (req, res) => {
    const t = await refreshUsage(req.tenantId);
    res.json(t!.toJSON());
  }),
);

tenantRouter.patch(
  "/",
  requireTenant,
  requirePermission("tenant:settings"),
  wrap(async (req, res) => {
    const input = parseBody(UpdateTenantSchema, req);
    const t = req.tenant!;
    const before = t.toJSON();
    if (input.name !== undefined) t.name = input.name;
    if (input.type !== undefined) t.type = input.type;
    if (input.city !== undefined) t.city = input.city;
    if (input.phone !== undefined) t.phone = input.phone;
    if (input.address !== undefined) t.address = input.address;
    if (input.settings) {
      const s = t.settings as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(input.settings)) {
        if (v !== undefined) s[k] = v;
      }
      t.markModified("settings");
    }
    await t.save();
    await audit(req, "tenant.update", "tenant", t._id, before, t.toJSON());
    res.json(t.toJSON());
  }),
);

tenantRouter.post(
  "/logo",
  requireTenant,
  requirePermission("tenant:settings"),
  imageUpload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Falta el archivo 'file'");
    const url = await storeFile(String(req.tenantId), req.file, "logo");
    const t = req.tenant!;
    t.settings.logoUrl = url;
    t.markModified("settings");
    await t.save();
    res.json(t.toJSON());
  }),
);
