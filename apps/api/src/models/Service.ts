import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { applyToJSON, tenantIdField } from "./base.js";

const ServiceSchema = new Schema(
  {
    tenantId: tenantIdField,
    name: { type: String, required: true },
    category: { type: String, default: "General" },
    suggestedPrice: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
ServiceSchema.index({ tenantId: 1, active: 1, name: 1 });
applyToJSON(ServiceSchema);

export type ServiceDoc = HydratedDocument<InferSchemaType<typeof ServiceSchema>>;
export const Service = model("Service", ServiceSchema);
