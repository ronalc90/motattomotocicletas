import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { ROLES } from "@motatto/shared";
import { applyToJSON } from "./base.js";

const UserSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: "" },
    role: { type: String, enum: ROLES, required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    inviteToken: { type: String, index: true, sparse: true },
    inviteExpiresAt: { type: Date },
  },
  { timestamps: true },
);
UserSchema.index({ tenantId: 1, role: 1 });
applyToJSON(UserSchema);

export type UserDoc = HydratedDocument<InferSchemaType<typeof UserSchema>>;
export const User = model("User", UserSchema);
