import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  ITEM_TYPES,
  MOVEMENT_TYPES,
  ORDER_SOURCES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  PLANS,
  PRODUCT_CATEGORIES,
  TENANT_ROLES,
  TENANT_STATUS,
  TENANT_TYPES,
  VEHICLE_KINDS,
} from "./enums.js";

const money = z.coerce.number().int().min(0);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "id inválido");
const slug = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Solo minúsculas, números y guiones");
const phone = z.string().trim().min(7).max(20);

// ---------- Auth / tenants ----------
export const RegisterTenantSchema = z.object({
  tenantName: z.string().trim().min(2).max(80),
  slug: slug.optional(),
  type: z.enum(TENANT_TYPES),
  city: z.string().trim().max(60).optional(),
  phone: phone.optional(),
  ownerName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});
export type RegisterTenantInput = z.infer<typeof RegisterTenantSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const SurchargeSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  pct: z.coerce.number().min(0).max(100),
});

export const TenantSettingsSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  slogan: z.string().max(120).optional(),
  address: z.string().max(160).optional(),
  phone: z.string().max(30).optional(),
  currency: z.string().length(3).default("COP"),
  invoicePrefix: z.string().trim().min(1).max(6).toUpperCase().default("MT"),
  invoiceYearReset: z.boolean().default(true),
  surcharges: z.array(SurchargeSchema).default([{ method: "nequi", pct: 3 }]),
  warrantyDays: z.coerce.number().int().min(0).max(365).default(9),
  warrantyText: z.string().max(2000).default(""),
  footerText: z.string().max(300).default(""),
  paymentInfo: z.string().max(200).default(""),
  askStockOnClose: z.boolean().default(true),
});

export const UpdateTenantSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  type: z.enum(TENANT_TYPES).optional(),
  city: z.string().trim().max(60).optional(),
  phone: phone.optional(),
  address: z.string().max(160).optional(),
  settings: TenantSettingsSchema.partial().optional(),
});
export type UpdateTenantInput = z.infer<typeof UpdateTenantSchema>;

export const SuperadminUpdateTenantSchema = z.object({
  plan: z.enum(PLANS).optional(),
  status: z.enum(TENANT_STATUS).optional(),
});

// ---------- Users ----------
export const InviteUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(TENANT_ROLES).exclude(["dueno"]),
});
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const AcceptInviteSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(100),
});

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(TENANT_ROLES).exclude(["dueno"]).optional(),
  active: z.boolean().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

// ---------- Customers / vehicles ----------
export const CustomerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phone.optional().or(z.literal("")),
  document: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type CustomerInput = z.infer<typeof CustomerSchema>;

export const VehicleSchema = z.object({
  customerId: objectId,
  kind: z.enum(VEHICLE_KINDS),
  brand: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(60),
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,10}$/)
    .optional()
    .or(z.literal("")),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  color: z.string().trim().max(30).optional().or(z.literal("")),
  lastKm: z.coerce.number().int().min(0).optional(),
});
export type VehicleInput = z.infer<typeof VehicleSchema>;

// ---------- Products / stock ----------
export const ProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  reference: z.string().trim().max(60).optional().or(z.literal("")),
  barcode: z.string().trim().max(60).optional().or(z.literal("")),
  brand: z.string().trim().max(40).optional().or(z.literal("")),
  category: z.enum(PRODUCT_CATEGORIES).default("otro"),
  compatibleWith: z.array(z.string().trim().min(1).max(40)).default([]),
  cost: money.default(0),
  price: money,
  minStock: z.coerce.number().int().min(0).default(1),
  location: z.string().trim().max(60).optional().or(z.literal("")),
  active: z.boolean().default(true),
  /** Only on create: initial stock, recorded as an "entrada" movement. */
  initialStock: z.coerce.number().int().min(0).optional(),
});
export type ProductInput = z.infer<typeof ProductSchema>;

export const StockMovementSchema = z.object({
  type: z.enum(MOVEMENT_TYPES).exclude(["salida", "devolucion"]),
  qty: z.coerce.number().int(),
  unitCost: money.optional(),
  supplier: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().max(300).optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
  registerExpense: z.boolean().default(false),
});
export type StockMovementInput = z.infer<typeof StockMovementSchema>;

/** For "ajuste": the actual counted quantity; the API computes the delta. */
export const StockAdjustSchema = z.object({
  countedQty: z.coerce.number().int().min(0),
  note: z.string().max(300).optional().or(z.literal("")),
});

// ---------- Services ----------
export const ServiceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().max(40).default("General"),
  suggestedPrice: money,
  active: z.boolean().default(true),
});
export type ServiceInput = z.infer<typeof ServiceSchema>;

// ---------- Orders ----------
export const OrderItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(ITEM_TYPES),
  productId: objectId.optional(),
  serviceId: objectId.optional(),
  description: z.string().trim().min(1).max(160),
  qty: z.coerce.number().int().min(1).default(1),
  unitPrice: money,
});
export type OrderItemInput = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  customerId: objectId,
  vehicleId: objectId,
  km: z.coerce.number().int().min(0).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(OrderItemSchema).default([]),
  discount: money.default(0),
  internalNotes: z.string().max(1000).optional().or(z.literal("")),
  photos: z.array(z.string().url()).default([]),
  warrantyOfOrderId: objectId.optional(),
  source: z.enum(ORDER_SOURCES).default("manual"),
  voiceTranscript: z.string().max(2000).optional(),
  assignedTo: objectId.optional(),
});
export type OrderInput = z.infer<typeof OrderSchema>;

export const OrderStatusChangeSchema = z.object({
  status: z.enum(ORDER_STATUS),
  /** When moving to "terminada": which product lines to deduct. Omit = ask / none. */
  deduct: z
    .array(z.object({ productId: objectId, qty: z.coerce.number().int().min(1) }))
    .optional(),
  voidReason: z.string().max(300).optional(),
});
export type OrderStatusChangeInput = z.infer<typeof OrderStatusChangeSchema>;

export const PaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: money.optional(), // defaults to order total (+ surcharge)
  reference: z.string().trim().max(60).optional().or(z.literal("")),
  /** When paying a "terminada" order with product lines not yet deducted. */
  deduct: z
    .array(z.object({ productId: objectId, qty: z.coerce.number().int().min(1) }))
    .optional(),
});
export type PaymentInput = z.infer<typeof PaymentSchema>;

// ---------- Cash ----------
export const ExpenseSchema = z.object({
  concept: z.string().trim().min(2).max(120),
  category: z.enum(EXPENSE_CATEGORIES).default("otro"),
  amount: money,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  receiptPhotoUrl: z.string().url().optional().or(z.literal("")),
});
export type ExpenseInput = z.infer<typeof ExpenseSchema>;

export const CloseDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ---------- Assistant ----------
export const AssistantSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  /** Client may pass a vehicle/customer already selected on screen. */
  context: z
    .object({ customerId: objectId.optional(), vehicleId: objectId.optional() })
    .optional(),
});
export type AssistantInput = z.infer<typeof AssistantSchema>;

export const ListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const OrderListQuerySchema = ListQuerySchema.extend({
  status: z.enum(ORDER_STATUS).optional(),
  customerId: objectId.optional(),
  vehicleId: objectId.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const ReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
