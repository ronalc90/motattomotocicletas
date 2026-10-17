import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { applyToJSON, tenantIdField } from "./base.js";

/** Consumo de IA por taller y mes (una fila por taller y mes). */
const AiUsageSchema = new Schema(
  {
    tenantId: tenantIdField,
    month: { type: String, required: true }, // "YYYY-MM"
    calls: { type: Number, default: 0 },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    transcriptions: { type: Number, default: 0 },
    audioSeconds: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
  },
  { timestamps: true },
);
AiUsageSchema.index({ tenantId: 1, month: 1 }, { unique: true });
applyToJSON(AiUsageSchema);

export type AiUsageDoc = HydratedDocument<InferSchemaType<typeof AiUsageSchema>>;
export const AiUsage = model("AiUsage", AiUsageSchema);
