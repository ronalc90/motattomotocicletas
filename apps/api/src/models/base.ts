import { Schema, Types } from "mongoose";

/** toJSON transform shared by all models: `_id` → `id`, drop `__v` and secrets. */
export function applyToJSON(schema: Schema): void {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      delete ret.__v;
      delete ret.passwordHash;
      delete ret.inviteToken;
      delete ret.inviteExpiresAt;
      return ret;
    },
  });
  schema.set("toObject", { virtuals: true, versionKey: false });
}

export const tenantIdField = { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true } as const;

export const oid = (v: string | Types.ObjectId): Types.ObjectId =>
  typeof v === "string" ? new Types.ObjectId(v) : v;
