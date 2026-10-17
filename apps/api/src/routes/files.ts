import { Router } from "express";
import { requireTenant, wrap } from "../middleware/auth.js";
import { notFound } from "../lib/errors.js";
import { keyBelongsTo, readFile } from "../services/storage.js";

/** Sirve fotos privadas de R2. Requiere sesión (auth ya aplicado a /api) y que el archivo sea del taller. */
export const filesRouter = Router();
filesRouter.get(
  "/*",
  requireTenant,
  wrap(async (req, res) => {
    const key = String(req.params[0] ?? "");
    if (!keyBelongsTo(String(req.tenantId), key)) throw notFound("Archivo");
    let file;
    try {
      file = await readFile(key);
    } catch {
      throw notFound("Archivo");
    }
    res.setHeader("Content-Type", file.contentType ?? "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(file.body);
  }),
);
