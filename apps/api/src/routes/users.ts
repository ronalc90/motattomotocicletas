import { Router } from "express";
import { nanoid } from "nanoid";
import { InviteUserSchema, UpdateUserSchema } from "@motatto/shared";
import { requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { parseBody } from "../middleware/validate.js";
import { User } from "../models/index.js";
import { config } from "../config.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { publicUser } from "../services/tenantService.js";
import { refreshUsage } from "./tenant.js";

export const usersRouter = Router();
usersRouter.use(requireTenant, requirePermission("users:manage"));

usersRouter.get(
  "/",
  wrap(async (req, res) => {
    const items = await User.find(scope(req)).sort({ createdAt: 1 });
    res.json({ items: items.map(publicUser), total: items.length, page: 1, limit: items.length });
  }),
);

usersRouter.post(
  "/invite",
  wrap(async (req, res) => {
    const input = parseBody(InviteUserSchema, req);
    if (await User.exists({ email: input.email })) throw conflict("Ya existe una cuenta con ese correo", "EMAIL_TAKEN");
    const token = nanoid(32);
    const user = await User.create({
      ...scope(req),
      name: input.name,
      email: input.email,
      role: input.role,
      active: false,
      invitedBy: req.user!._id,
      inviteToken: token,
      inviteExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    });
    await audit(req, "user.invite", "user", user._id, undefined, { email: user.email, role: user.role });
    res.status(201).json({ inviteUrl: `${config.webUrl}/invitacion/${token}`, user: publicUser(user) });
  }),
);

usersRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const input = parseBody(UpdateUserSchema, req);
    const user = await User.findOne({ _id: req.params.id, ...scope(req) });
    if (!user) throw notFound("Usuario");
    if (user.role === "dueno" && (input.role !== undefined || input.active === false)) {
      throw badRequest("No se puede cambiar el rol ni desactivar al dueño", "OWNER_PROTECTED");
    }
    const before = publicUser(user);
    if (input.name !== undefined) user.name = input.name;
    if (input.role !== undefined) user.role = input.role;
    if (input.active !== undefined) user.active = input.active;
    await user.save();
    await audit(req, "user.update", "user", user._id, before, publicUser(user));
    await refreshUsage(req.tenantId);
    res.json(publicUser(user));
  }),
);

usersRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, ...scope(req) });
    if (!user) throw notFound("Usuario");
    if (user.role === "dueno") throw badRequest("El dueño no se puede eliminar", "OWNER_PROTECTED");
    if (String(user._id) === String(req.user!._id)) throw badRequest("No puedes eliminarte a ti mismo");
    const before = publicUser(user);
    user.active = false;
    user.inviteToken = undefined;
    await user.save();
    await audit(req, "user.delete", "user", user._id, before, publicUser(user));
    await refreshUsage(req.tenantId);
    res.json(publicUser(user));
  }),
);
