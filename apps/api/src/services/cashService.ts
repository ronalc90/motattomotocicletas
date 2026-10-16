import type { Types } from "mongoose";
import type { CashClosingTotals } from "@motatto/shared";
import { Expense, Payment } from "../models/index.js";
import { dayRange } from "../lib/dates.js";

export async function dayData(tenantId: Types.ObjectId, date: string) {
  const { start, end } = dayRange(date);
  const [payments, expenses] = await Promise.all([
    Payment.find({ tenantId, createdAt: { $gte: start, $lt: end } }).sort({ createdAt: 1 }),
    Expense.find({ tenantId, date }).sort({ createdAt: 1 }),
  ]);
  const totals: CashClosingTotals = { efectivo: 0, nequi: 0, transferencia: 0, otro: 0, surcharges: 0, expenses: 0, sales: 0, net: 0 };
  for (const p of payments) {
    if (p.voided) continue;
    totals[p.method as keyof Pick<CashClosingTotals, "efectivo" | "nequi" | "transferencia" | "otro">] += p.amount;
    totals.surcharges += p.surcharge ?? 0;
    totals.sales += p.amount;
  }
  for (const e of expenses) totals.expenses += e.amount;
  totals.net = totals.sales - totals.expenses;
  return { payments, expenses, totals };
}
