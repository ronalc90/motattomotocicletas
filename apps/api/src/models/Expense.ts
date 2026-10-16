import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { EXPENSE_CATEGORIES } from "@motatto/shared";
import { applyToJSON, tenantIdField } from "./base.js";

const ExpenseSchema = new Schema(
  {
    tenantId: tenantIdField,
    concept: { type: String, required: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "otro" },
    amount: { type: Number, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD in workshop timezone
    movementId: { type: Schema.Types.ObjectId, ref: "StockMovement" },
    receiptPhotoUrl: { type: String, default: "" },
    closingId: { type: Schema.Types.ObjectId, ref: "CashClosing" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
ExpenseSchema.index({ tenantId: 1, date: -1 });
applyToJSON(ExpenseSchema);

export type ExpenseDoc = HydratedDocument<InferSchemaType<typeof ExpenseSchema>>;
export const Expense = model("Expense", ExpenseSchema);
