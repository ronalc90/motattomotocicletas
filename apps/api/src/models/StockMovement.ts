import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { MOVEMENT_TYPES } from "@motatto/shared";
import { applyToJSON, tenantIdField } from "./base.js";

const StockMovementSchema = new Schema(
  {
    tenantId: tenantIdField,
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    qty: { type: Number, required: true },
    unitCost: { type: Number },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    supplier: { type: String, default: "" },
    note: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
StockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
StockMovementSchema.index({ tenantId: 1, createdAt: -1 });
applyToJSON(StockMovementSchema);

export type StockMovementDoc = HydratedDocument<InferSchemaType<typeof StockMovementSchema>>;
export const StockMovement = model("StockMovement", StockMovementSchema);
