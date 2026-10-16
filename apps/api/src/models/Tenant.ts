import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { PAYMENT_METHODS, PLANS, TENANT_STATUS, TENANT_TYPES } from "@motatto/shared";
import { applyToJSON } from "./base.js";

const SurchargeSchema = new Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    pct: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const SettingsSchema = new Schema(
  {
    logoUrl: { type: String, default: "" },
    slogan: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    currency: { type: String, default: "COP" },
    invoicePrefix: { type: String, default: "MT" },
    invoiceNextNumber: { type: Number, default: 1 },
    invoiceYearReset: { type: Boolean, default: true },
    surcharges: { type: [SurchargeSchema], default: [{ method: "nequi", pct: 3 }] },
    warrantyDays: { type: Number, default: 9 },
    warrantyText: { type: String, default: "" },
    footerText: { type: String, default: "" },
    paymentInfo: { type: String, default: "" },
    askStockOnClose: { type: Boolean, default: true },
  },
  { _id: false },
);

const UsageSchema = new Schema(
  {
    ordersThisMonth: { type: Number, default: 0 },
    usersCount: { type: Number, default: 0 },
    productsCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const TenantSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: TENANT_TYPES, required: true },
    city: { type: String },
    phone: { type: String },
    address: { type: String },
    email: { type: String, required: true },
    plan: { type: String, enum: PLANS, default: "gratis" },
    status: { type: String, enum: TENANT_STATUS, default: "activo" },
    settings: { type: SettingsSchema, default: () => ({}) },
    usage: { type: UsageSchema, default: () => ({}) },
  },
  { timestamps: true },
);
applyToJSON(TenantSchema);

export type TenantDoc = HydratedDocument<InferSchemaType<typeof TenantSchema>>;
export const Tenant = model("Tenant", TenantSchema);
