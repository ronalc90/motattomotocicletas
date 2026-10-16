import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { PAYMENT_METHODS } from "@motatto/shared";
import { applyToJSON, tenantIdField } from "./base.js";

const PaymentSchema = new Schema(
  {
    tenantId: tenantIdField,
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true },
    surcharge: { type: Number, default: 0 },
    reference: { type: String, default: "" },
    closingId: { type: Schema.Types.ObjectId, ref: "CashClosing" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    voided: { type: Boolean, default: false },
  },
  { timestamps: true },
);
PaymentSchema.index({ tenantId: 1, createdAt: -1 });
PaymentSchema.index({ tenantId: 1, orderId: 1 });
applyToJSON(PaymentSchema);

export type PaymentDoc = HydratedDocument<InferSchemaType<typeof PaymentSchema>>;
export const Payment = model("Payment", PaymentSchema);
