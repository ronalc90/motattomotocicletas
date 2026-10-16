import { Schema, model, type Types } from "mongoose";

/** Atomic per-tenant counters (invoice numbers). key = `${year}` or "all". */
const CounterSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true },
    key: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: false },
);
CounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const Counter = model("Counter", CounterSchema);

export async function nextSequence(tenantId: Types.ObjectId | string, key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { tenantId, key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return doc!.seq;
}
