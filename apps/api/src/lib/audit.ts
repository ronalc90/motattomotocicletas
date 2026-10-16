import type { Request } from "express";
import { AuditLog } from "../models/index.js";
import { logger } from "./logger.js";

export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId?: unknown,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  try {
    await AuditLog.create({
      tenantId: req.tenantId ?? null,
      userId: req.user!._id,
      action,
      entity,
      entityId: entityId != null ? String(entityId) : undefined,
      before: before ?? undefined,
      after: after ?? undefined,
      ip: req.ip,
    });
  } catch (err) {
    logger.warn({ err }, "audit write failed");
  }
}
