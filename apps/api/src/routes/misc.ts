import { Router } from "express";
import { z } from "zod";
import { requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { AuditLog, User } from "../models/index.js";
import { badRequest } from "../lib/errors.js";
import { imageUpload, storeFile } from "../services/storage.js";

export const uploadsRouter = Router();
uploadsRouter.use(requireTenant);
uploadsRouter.post(
  "/",
  imageUpload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Falta el archivo 'file'");
    const folder = typeof req.body?.folder === "string" ? req.body.folder.replace(/[^a-z0-9/_-]/gi, "") : "misc";
    const url = await storeFile(String(req.tenantId), req.file, folder || "misc");
    res.status(201).json({ url });
  }),
);

export const auditRouter = Router();
auditRouter.use(requireTenant, requirePermission("tenant:settings"));
auditRouter.get(
  "/",
  wrap(async (req, res) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
    const items = await AuditLog.find(scope(req)).sort({ createdAt: -1 }).limit(q.limit);
    const users = await User.find({ _id: { $in: [...new Set(items.map((a) => String(a.userId)))] } }).select("name email");
    const um = new Map(users.map((u) => [String(u._id), u]));
    res.json({
      items: items.map((a) => {
        const u = um.get(String(a.userId));
        return { ...a.toJSON(), user: u ? { id: String(u._id), name: u.name, email: u.email } : undefined };
      }),
      total: items.length,
      page: 1,
      limit: q.limit,
    });
  }),
);
