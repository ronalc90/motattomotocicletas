import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { applyToJSON, tenantIdField } from "./base.js";

const CustomerSchema = new Schema(
  {
    tenantId: tenantIdField,
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    document: { type: String, default: "" },
    notes: { type: String, default: "" },
    vehicleIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true },
);
CustomerSchema.index({ tenantId: 1, phone: 1 });
CustomerSchema.index({ tenantId: 1, name: 1 });
CustomerSchema.index({ name: "text", phone: "text", document: "text" });
applyToJSON(CustomerSchema);

export type CustomerDoc = HydratedDocument<InferSchemaType<typeof CustomerSchema>>;
export const Customer = model("Customer", CustomerSchema);
