import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Types } from "mongoose";
import { can, type Permission, type Role } from "@motatto/shared";
import { verifyToken } from "../lib/jwt.js";
import { AppError, forbidden } from "../lib/errors.js";
import { Tenant, User, type TenantDoc, type UserDoc } from "../models/index.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
      role?: Role;
      tenantId?: Types.ObjectId;
      tenant?: TenantDoc | null;
      impersonating?: boolean;
    }
  }
}

function readToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) return h.slice(7).trim();
  const q = req.query.token;
  if (typeof q === "string" && q.length > 10) return q;
  return null;
}

/** Required authentication. Loads user and tenant, enforces suspended tenant rule. */
export const auth: RequestHandler = async (req, _res, next) => {
  try {
    const token = readToken(req);
    if (!token) throw new AppError(401, "UNAUTHORIZED", "Inicia sesión para continuar");
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Sesión inválida o vencida");
    }
    const user = await User.findById(payload.sub);
    if (!user || !user.active) throw new AppError(401, "UNAUTHORIZED", "Usuario inactivo");
    req.user = user;
    req.impersonating = payload.imp === true;

    if (payload.imp && payload.tenantId) {
      // Superadmin impersonation token: acts as dueno of that tenant.
      req.role = "dueno";
      req.tenantId = new Types.ObjectId(payload.tenantId);
    } else if (user.role === "superadmin") {
      req.role = "superadmin";
      const header = req.header("X-Tenant-Id");
      req.tenantId = header && Types.ObjectId.isValid(header) ? new Types.ObjectId(header) : undefined;
    } else {
      req.role = user.role as Role;
      req.tenantId = user.tenantId ? new Types.ObjectId(String(user.tenantId)) : undefined;
    }

    req.tenant = req.tenantId ? await Tenant.findById(req.tenantId) : null;
    if (req.tenantId && !req.tenant) throw new AppError(401, "UNAUTHORIZED", "Taller no encontrado");

    const fullPath = (req.originalUrl ?? req.path).split("?")[0].replace(/\/$/, "");
    const exemptPath = fullPath === "/api/auth/me" || (fullPath === "/api/tenant" && req.method === "GET");
    if (req.tenant && req.tenant.status === "suspendido" && !exemptPath && req.role !== "superadmin") {
      throw new AppError(403, "TENANT_SUSPENDED", "Este taller está suspendido. Contacta al soporte.");
    }
    next();
  } catch (e) {
    next(e);
  }
};

/** Ensures the request has a tenant context (all tenant routes). */
export const requireTenant: RequestHandler = (req, _res, next) => {
  if (!req.tenantId || !req.tenant) {
    return next(new AppError(400, "TENANT_REQUIRED", "Esta acción requiere un taller (X-Tenant-Id para superadmin)"));
  }
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.role || !roles.includes(req.role)) return next(forbidden());
    next();
  };
}

export function requirePermission(perm: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!can(req.role, perm)) return next(forbidden());
    next();
  };
}

export const hasPerm = (req: Request, perm: Permission): boolean => can(req.role, perm);

/** Tenant scoping helper: every query must spread this filter. */
export function scope(req: Request): { tenantId: Types.ObjectId } {
  if (!req.tenantId) throw new AppError(400, "TENANT_REQUIRED", "Taller requerido");
  return { tenantId: req.tenantId };
}

export const tid = (req: Request): Types.ObjectId => scope(req).tenantId;
export const uid = (req: Request): Types.ObjectId => req.user!._id as Types.ObjectId;

export type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;
export const wrap =
  (fn: Handler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
