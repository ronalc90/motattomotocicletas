import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { applyToJSON, tenantIdField } from "./base.js";

const TotalsSchema = new Schema(
  {
    efectivo: { type: Number, default: 0 },
    nequi: { type: Number, default: 0 },
    transferencia: { type: Number, default: 0 },
    otro: { type: Number, default: 0 },
    surcharges: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
  },
  { _id: false },
);

const CashClosingSchema = new Schema(
  {
    tenantId: tenantIdField,
    date: { type: String, required: true },
    totals: { type: TotalsSchema, default: () => ({}) },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reopened: { type: Boolean, default: false },
  },
  { timestamps: true },
);
CashClosingSchema.index({ tenantId: 1, date: 1 }, { unique: true });
applyToJSON(CashClosingSchema);

export type CashClosingDoc = HydratedDocument<InferSchemaType<typeof CashClosingSchema>>;
export const CashClosing = model("CashClosing", CashClosingSchema);
