import bcrypt from "bcryptjs";
import {
  DEFAULT_FOOTER_TEXT,
  DEFAULT_WARRANTY_TEXT,
  seedServicesFor,
  type RegisterTenantInput,
  type Tenant as TenantT,
  type User as UserT,
} from "@motatto/shared";
import { Service, Tenant, User, type TenantDoc, type UserDoc } from "../models/index.js";
import { slugify } from "../lib/text.js";
import { conflict } from "../lib/errors.js";

export async function uniqueSlug(base: string): Promise<string> {
  let s = slugify(base) || "taller";
  if (s.length < 3) s = `${s}-taller`.slice(0, 40);
  let candidate = s;
  let i = 2;
  while (await Tenant.exists({ slug: candidate })) {
    candidate = `${s.slice(0, 36)}-${i++}`;
  }
  return candidate;
}

export function prefixFromName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0] + (words[2]?.[0] ?? "")).slice(0, 3);
  return (words[0] ?? "MT").slice(0, 3) || "MT";
}

export async function registerTenant(input: RegisterTenantInput): Promise<{ tenant: TenantDoc; user: UserDoc }> {
  if (await User.exists({ email: input.email })) {
    throw conflict("Ya existe una cuenta con ese correo", "EMAIL_TAKEN");
  }
  let slug: string;
  if (input.slug) {
    if (await Tenant.exists({ slug: input.slug })) throw conflict("Ese identificador ya está en uso", "SLUG_TAKEN");
    slug = input.slug;
  } else {
    slug = await uniqueSlug(input.tenantName);
  }
  const tenant = await Tenant.create({
    slug,
    name: input.tenantName,
    type: input.type,
    city: input.city,
    phone: input.phone,
    email: input.email,
    settings: {
      phone: input.phone ?? "",
      surcharges: [{ method: "nequi", pct: 3 }],
      warrantyDays: 9,
      warrantyText: DEFAULT_WARRANTY_TEXT,
      footerText: DEFAULT_FOOTER_TEXT,
      invoicePrefix: prefixFromName(input.tenantName),
      paymentInfo: "",
    },
    usage: { usersCount: 1, productsCount: 0, ordersThisMonth: 0 },
  });
  const user = await User.create({
    tenantId: tenant._id,
    name: input.ownerName,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
    role: "dueno",
    active: true,
  });
  await Service.insertMany(
    seedServicesFor(input.type).map((s) => ({ tenantId: tenant._id, ...s, active: true })),
  );
  return { tenant, user };
}

export function publicUser(u: UserDoc): UserT {
  return u.toJSON() as unknown as UserT;
}

export function publicTenant(t: TenantDoc | null | undefined): TenantT | null {
  return t ? (t.toJSON() as unknown as TenantT) : null;
}
