export const TENANT_TYPES = ["motos", "carros", "ambos"] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

export const TENANT_STATUS = ["activo", "suspendido"] as const;
export type TenantStatus = (typeof TENANT_STATUS)[number];

export const PLANS = ["gratis", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const ROLES = ["superadmin", "dueno", "admin", "mecanico", "cajero", "contador"] as const;
export type Role = (typeof ROLES)[number];
/** Roles that belong to a tenant (everything except superadmin). */
export const TENANT_ROLES = ["dueno", "admin", "mecanico", "cajero", "contador"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const VEHICLE_KINDS = ["moto", "carro"] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export const ORDER_STATUS = ["recibida", "cotizada", "en_proceso", "terminada", "pagada", "anulada"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  recibida: "Recibida",
  cotizada: "Cotizada",
  en_proceso: "En proceso",
  terminada: "Terminada",
  pagada: "Pagada",
  anulada: "Anulada",
};

/** Allowed transitions. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  recibida: ["cotizada", "en_proceso", "terminada", "anulada"],
  cotizada: ["en_proceso", "terminada", "anulada", "recibida"],
  en_proceso: ["terminada", "anulada", "cotizada"],
  terminada: ["pagada", "anulada", "en_proceso"],
  pagada: ["anulada"],
  anulada: [],
};

export const ITEM_TYPES = ["repuesto", "servicio", "otro"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const MOVEMENT_TYPES = ["entrada", "salida", "ajuste", "devolucion"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const PAYMENT_METHODS = ["efectivo", "nequi", "transferencia", "otro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  transferencia: "Transferencia",
  otro: "Otro",
};

export const EXPENSE_CATEGORIES = ["repuestos", "arriendo", "servicios", "herramienta", "nomina", "otro"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const ORDER_SOURCES = ["manual", "voz", "foto"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const PRODUCT_CATEGORIES = [
  "bujias",
  "frenos",
  "lubricantes",
  "filtros",
  "transmision",
  "suspension",
  "electrico",
  "llantas",
  "motor",
  "carroceria",
  "accesorios",
  "otro",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  bujias: "Bujías",
  frenos: "Frenos",
  lubricantes: "Lubricantes",
  filtros: "Filtros",
  transmision: "Transmisión",
  suspension: "Suspensión y dirección",
  electrico: "Eléctrico",
  llantas: "Llantas",
  motor: "Motor",
  carroceria: "Carrocería",
  accesorios: "Accesorios",
  otro: "Otro",
};
