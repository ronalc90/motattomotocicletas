import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Datos inválidos",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { code: "BAD_ID", message: "Identificador inválido" } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: { code: "VALIDATION", message: err.message } });
  }
  const anyErr = err as { code?: number | string; type?: string; status?: number; message?: string };
  if (anyErr?.code === 11000) {
    return res.status(409).json({ error: { code: "DUPLICATE", message: "Ya existe un registro con esos datos" } });
  }
  if (anyErr?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "TOO_LARGE", message: "Contenido demasiado grande" } });
  }
  if (anyErr?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: { code: "TOO_LARGE", message: "Archivo demasiado grande (máx. 8MB)" } });
  }
  if (typeof anyErr?.status === "number" && anyErr.status >= 400 && anyErr.status < 500) {
    return res.status(anyErr.status).json({ error: { code: "BAD_REQUEST", message: anyErr.message ?? "Solicitud inválida" } });
  }
  logger.error({ err }, "Unhandled error");
  return res.status(500).json({ error: { code: "INTERNAL", message: "Error interno del servidor" } });
};
