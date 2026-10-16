import jwt from "jsonwebtoken";
import type { Role } from "@motatto/shared";
import { config } from "../config.js";

export interface TokenPayload {
  sub: string;
  tenantId: string | null;
  role: Role;
  imp?: boolean;
}

export function signToken(payload: TokenPayload, expiresIn: string = config.jwtExpires): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  return {
    sub: String(decoded.sub),
    tenantId: decoded.tenantId ?? null,
    role: decoded.role as Role,
    imp: decoded.imp === true,
  };
}
