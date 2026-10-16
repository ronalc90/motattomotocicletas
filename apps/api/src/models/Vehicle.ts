import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { VEHICLE_KINDS } from "@motatto/shared";
import { applyToJSON, tenantIdField } from "./base.js";

const VehicleSchema = new Schema(
  {
    tenantId: tenantIdField,
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    kind: { type: String, enum: VEHICLE_KINDS, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    plate: { type: String, default: "" },
    year: { type: Number },
    color: { type: String, default: "" },
    lastKm: { type: Number },
    photos: { type: [String], default: [] },
  },
  { timestamps: true },
);
VehicleSchema.index(
  { tenantId: 1, plate: 1 },
  { unique: true, partialFilterExpression: { plate: { $type: "string", $gt: "" } } },
);
VehicleSchema.index({ tenantId: 1, customerId: 1 });
applyToJSON(VehicleSchema);

export type VehicleDoc = HydratedDocument<InferSchemaType<typeof VehicleSchema>>;
export const Vehicle = model("Vehicle", VehicleSchema);
