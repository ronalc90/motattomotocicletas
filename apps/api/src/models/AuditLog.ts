import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { applyToJSON } from "./base.js";

const AuditLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true },
);
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
applyToJSON(AuditLogSchema);

export type AuditLogDoc = HydratedDocument<InferSchemaType<typeof AuditLogSchema>>;
export const AuditLog = model("AuditLog", AuditLogSchema);
