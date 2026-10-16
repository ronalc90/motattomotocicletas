import type { Role } from "./enums.js";

export const PERMISSIONS = {
  "platform:manage": ["superadmin"],
  "tenant:settings": ["superadmin", "dueno", "admin"],
  "tenant:delete": ["superadmin", "dueno"],
  "users:manage": ["superadmin", "dueno", "admin"],
  "customers:read": ["superadmin", "dueno", "admin", "mecanico", "cajero", "contador"],
  "customers:write": ["superadmin", "dueno", "admin", "mecanico", "cajero"],
  "orders:read": ["superadmin", "dueno", "admin", "mecanico", "cajero", "contador"],
  "orders:write": ["superadmin", "dueno", "admin", "mecanico", "cajero"],
  "orders:price": ["superadmin", "dueno", "admin", "cajero"],
  "orders:discount": ["superadmin", "dueno", "admin"],
  "orders:finish": ["superadmin", "dueno", "admin", "mecanico"],
  "orders:pay": ["superadmin", "dueno", "admin", "cajero"],
  "orders:void": ["superadmin", "dueno", "admin"],
  "inventory:read": ["superadmin", "dueno", "admin", "mecanico", "cajero", "contador"],
  "inventory:cost": ["superadmin", "dueno", "admin", "contador"],
  "inventory:entry": ["superadmin", "dueno", "admin", "mecanico"],
  "inventory:manage": ["superadmin", "dueno", "admin"],
  "services:manage": ["superadmin", "dueno", "admin"],
  "cash:read": ["superadmin", "dueno", "admin", "cajero", "contador"],
  "cash:write": ["superadmin", "dueno", "admin", "cajero"],
  "cash:reopen": ["superadmin", "dueno", "admin"],
  "reports:read": ["superadmin", "dueno", "admin", "contador"],
  "assistant:use": ["superadmin", "dueno", "admin", "mecanico", "cajero"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadministrador",
  dueno: "Dueño",
  admin: "Administrador",
  mecanico: "Mecánico",
  cajero: "Cajero",
  contador: "Contador",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  superadmin: "Opera la plataforma: ve y administra todos los talleres.",
  dueno: "Dueño del taller. Acceso a todo.",
  admin: "Persona de confianza. Todo, menos borrar el taller.",
  mecanico: "Crea órdenes, usa el inventario y marca trabajos terminados. No ve dinero ni costos.",
  cajero: "Cobra, registra pagos y cierra caja. No edita inventario ni catálogo.",
  contador: "Solo lectura de facturas, caja y reportes. Exporta a Excel.",
};
