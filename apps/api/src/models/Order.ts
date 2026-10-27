import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { ITEM_TYPES, ORDER_SOURCES, ORDER_STATUS, PAYMENT_METHODS } from "@motatto/shared";
import { applyToJSON, tenantIdField } from "./base.js";

const OrderItemSchema = new Schema(
  {
    type: { type: String, enum: ITEM_TYPES, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service" },
    description: { type: String, required: true },
    qty: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true },
    unitCost: { type: Number },
    total: { type: Number, required: true },
    pos: { type: Number, required: true },
  },
  { _id: true },
);
applyToJSON(OrderItemSchema);

const StockDeductedSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true },
    movementId: { type: Schema.Types.ObjectId, ref: "StockMovement", required: true },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    tenantId: tenantIdField,
    number: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    km: { type: Number },
    description: { type: String, default: "" },
    status: { type: String, enum: ORDER_STATUS, default: "recibida" },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    surcharge: { type: Number, default: 0 },
    surchargeMethod: { type: String, enum: PAYMENT_METHODS },
    total: { type: Number, default: 0 },
    stockDeducted: { type: [StockDeductedSchema], default: [] },
    photos: { type: [String], default: [] },
    internalNotes: { type: String, default: "" },
    warrantyUntil: { type: Date },
    warrantyOfOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
    paidAt: { type: Date },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String },
    source: { type: String, enum: ORDER_SOURCES, default: "manual" },
    voiceTranscript: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    /** Clave aleatoria del link público (/cc/:slug/:number?k=...). Sin default: se asigna al crear o al pedir la factura. */
    publicToken: { type: String },
  },
  { timestamps: true },
);
OrderSchema.index({ tenantId: 1, number: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, vehicleId: 1 });
OrderSchema.index({ tenantId: 1, customerId: 1 });
OrderSchema.index({ tenantId: 1, paidAt: 1 });
applyToJSON(OrderSchema);

export type OrderDoc = HydratedDocument<InferSchemaType<typeof OrderSchema>>;
export const Order = model("Order", OrderSchema);
