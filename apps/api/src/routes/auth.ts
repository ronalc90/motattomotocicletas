import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  AcceptInviteSchema,
  ChangePasswordSchema,
  LoginSchema,
  RegisterTenantSchema,
  type Role,
} from "@motatto/shared";
import { auth, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { signToken } from "../lib/jwt.js";
import { AppError, badRequest, notFound } from "../lib/errors.js";
import { Tenant, User } from "../models/index.js";
import { publicTenant, publicUser, registerTenant } from "../services/tenantService.js";
import { audit } from "../lib/audit.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  wrap(async (req, res) => {
    const input = parseBody(RegisterTenantSchema, req);
    const { tenant, user } = await registerTenant(input);
    const token = signToken({ sub: String(user._id), tenantId: String(tenant._id), role: "dueno" });
    res.status(201).json({ token, user: publicUser(user), tenant: publicTenant(tenant) });
  }),
);

authRouter.post(
  "/login",
  wrap(async (req, res) => {
    const input = parseBody(LoginSchema, req);
    const user = await User.findOne({ email: input.email });
    if (!user || !user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "BAD_CREDENTIALS", "Correo o contraseña incorrectos");
    }
    if (!user.active) throw new AppError(403, "USER_INACTIVE", "Tu usuario está desactivado");
    user.lastLoginAt = new Date();
    await user.save();
    const tenant = user.tenantId ? await Tenant.findById(user.tenantId) : null;
    const token = signToken({
      sub: String(user._id),
      tenantId: tenant ? String(tenant._id) : null,
      role: user.role as Role,
    });
    res.json({ token, user: publicUser(user), tenant: publicTenant(tenant) });
  }),
);

authRouter.get(
  "/me",
  auth,
  wrap(async (req, res) => {
    const user = publicUser(req.user!);
    if (req.impersonating) {
      (user as unknown as Record<string, unknown>).impersonating = true;
      (user as unknown as Record<string, unknown>).effectiveRole = req.role;
    }
    res.json({ user, tenant: publicTenant(req.tenant) });
  }),
);

authRouter.post(
  "/password",
  auth,
  wrap(async (req, res) => {
    const input = parseBody(ChangePasswordSchema, req);
    const user = req.user!;
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw badRequest("La contraseña actual no es correcta", "BAD_CREDENTIALS");
    }
    user.passwordHash = await bcrypt.hash(input.newPassword, 10);
    await user.save();
    await audit(req, "user.password_change", "user", user._id);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/invite/:token",
  wrap(async (req, res) => {
    const user = await User.findOne({ inviteToken: req.params.token });
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new AppError(404, "INVITE_INVALID", "La invitación no existe o ya venció");
    }
    const tenant = await Tenant.findById(user.tenantId);
    res.json({ name: user.name, email: user.email, role: user.role, tenantName: tenant?.name ?? "" });
  }),
);

authRouter.post(
  "/invite/accept",
  wrap(async (req, res) => {
    const input = parseBody(AcceptInviteSchema, req);
    const user = await User.findOne({ inviteToken: input.token });
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new AppError(404, "INVITE_INVALID", "La invitación no existe o ya venció");
    }
    user.passwordHash = await bcrypt.hash(input.password, 10);
    user.active = true;
    user.inviteToken = undefined;
    user.inviteExpiresAt = undefined;
    user.lastLoginAt = new Date();
    await user.save();
    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) throw notFound("Taller");
    const token = signToken({ sub: String(user._id), tenantId: String(tenant._id), role: user.role as Role });
    res.json({ token, user: publicUser(user), tenant: publicTenant(tenant) });
  }),
);
