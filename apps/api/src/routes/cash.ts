import { Router } from "express";
import { z } from "zod";
import { CloseDaySchema, ExpenseSchema } from "@motatto/shared";
import { requirePermission, requireTenant, scope, uid, wrap } from "../middleware/auth.js";
import { parseBody, parseQuery } from "../middleware/validate.js";
import { CashClosing, Expense, Order, Payment } from "../models/index.js";
import { rangeOf, toDayString } from "../lib/dates.js";
import { conflict, notFound, badRequest } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { dayData } from "../services/cashService.js";

const RangeQuery = z.object({ from: z.string().optional(), to: z.string().optional() });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const paymentsRouter = Router();
paymentsRouter.use(requireTenant, requirePermission("cash:read"));
paymentsRouter.get(
  "/",
  wrap(async (req, res) => {
    const q = parseQuery(RangeQuery, req);
    const filter: Record<string, unknown> = { ...scope(req) };
    if (q.from || q.to) {
      const r = rangeOf(q.from ?? "2000-01-01", q.to ?? "2100-01-01");
      filter.createdAt = { $gte: r.start, $lt: r.end };
    }
    const items = await Payment.find(filter).sort({ createdAt: -1 }).limit(1000);
    const orders = await Order.find({ ...scope(req), _id: { $in: items.map((p) => p.orderId) } }).select("number customerId");
    const om = new Map(orders.map((o) => [String(o._id), o]));
    res.json({
      items: items.map((p) => ({ ...p.toJSON(), orderNumber: om.get(String(p.orderId))?.number })),
      total: items.length,
      page: 1,
      limit: items.length,
    });
  }),
);

export const expensesRouter = Router();
expensesRouter.use(requireTenant);
expensesRouter.get(
  "/",
  requirePermission("cash:read"),
  wrap(async (req, res) => {
    const q = parseQuery(RangeQuery, req);
    const filter: Record<string, unknown> = { ...scope(req) };
    if (q.from || q.to) filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    const items = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(1000);
    res.json({ items: items.map((e) => e.toJSON()), total: items.length, page: 1, limit: items.length });
  }),
);
expensesRouter.post(
  "/",
  requirePermission("cash:write"),
  wrap(async (req, res) => {
    const input = parseBody(ExpenseSchema, req);
    const date = input.date ?? toDayString();
    const closed = await CashClosing.findOne({ ...scope(req), date, reopened: false });
    if (closed) throw conflict("El día ya está cerrado; reábrelo para registrar gastos", "DAY_CLOSED");
    const e = await Expense.create({ ...scope(req), ...input, date, userId: uid(req) });
    res.status(201).json(e.toJSON());
  }),
);
expensesRouter.delete(
  "/:id",
  requirePermission("cash:write"),
  wrap(async (req, res) => {
    const e = await Expense.findOne({ _id: req.params.id, ...scope(req) });
    if (!e) throw notFound("Gasto");
    if (e.closingId) throw conflict("El gasto pertenece a un día cerrado", "DAY_CLOSED");
    await e.deleteOne();
    await audit(req, "expense.delete", "expense", e._id, e.toJSON());
    res.json({ ok: true, id: String(e._id) });
  }),
);

export const cashRouter = Router();
cashRouter.use(requireTenant);

cashRouter.get(
  "/day",
  requirePermission("cash:read"),
  wrap(async (req, res) => {
    const date = typeof req.query.date === "string" && DAY.test(req.query.date) ? req.query.date : toDayString();
    const { payments, expenses, totals } = await dayData(req.tenantId!, date);
    const closing = await CashClosing.findOne({ ...scope(req), date });
    const orders = await Order.find({ ...scope(req), _id: { $in: payments.map((p) => p.orderId) } }).select("number");
    const om = new Map(orders.map((o) => [String(o._id), o.number]));
    res.json({
      date,
      totals,
      closing: closing ? closing.toJSON() : null,
      payments: payments.map((p) => ({ ...p.toJSON(), orderNumber: om.get(String(p.orderId)) })),
      expenses: expenses.map((e) => e.toJSON()),
    });
  }),
);

cashRouter.post(
  "/close",
  requirePermission("cash:write"),
  wrap(async (req, res) => {
    const input = parseBody(CloseDaySchema, req);
    const date = input.date ?? toDayString();
    const existing = await CashClosing.findOne({ ...scope(req), date });
    if (existing && !existing.reopened) throw conflict("El día ya está cerrado", "ALREADY_CLOSED");
    const { payments, expenses, totals } = await dayData(req.tenantId!, date);
    const closing = await CashClosing.findOneAndUpdate(
      { ...scope(req), date },
      { $set: { totals, closedBy: uid(req), reopened: false } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await Promise.all([
      Payment.updateMany({ _id: { $in: payments.map((p) => p._id) } }, { $set: { closingId: closing!._id } }),
      Expense.updateMany({ _id: { $in: expenses.map((e) => e._id) } }, { $set: { closingId: closing!._id } }),
    ]);
    await audit(req, "cash.close", "cashClosing", closing!._id, undefined, { date, totals });
    res.status(existing ? 200 : 201).json(closing!.toJSON());
  }),
);

cashRouter.post(
  "/reopen",
  requirePermission("cash:reopen"),
  wrap(async (req, res) => {
    const date = String(req.body?.date ?? "");
    if (!DAY.test(date)) throw badRequest("Fecha inválida (YYYY-MM-DD)");
    const closing = await CashClosing.findOne({ ...scope(req), date });
    if (!closing) throw notFound("Cierre");
    if (closing.reopened) throw conflict("El día ya está reabierto", "ALREADY_OPEN");
    closing.reopened = true;
    await closing.save();
    await Promise.all([
      Payment.updateMany({ ...scope(req), closingId: closing._id }, { $unset: { closingId: 1 } }),
      Expense.updateMany({ ...scope(req), closingId: closing._id }, { $unset: { closingId: 1 } }),
    ]);
    await audit(req, "cash.reopen", "cashClosing", closing._id, undefined, { date });
    res.json(closing.toJSON());
  }),
);

cashRouter.get(
  "/closings",
  requirePermission("cash:read"),
  wrap(async (req, res) => {
    const q = parseQuery(RangeQuery, req);
    const filter: Record<string, unknown> = { ...scope(req) };
    if (q.from || q.to) filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    const items = await CashClosing.find(filter).sort({ date: -1 }).limit(400);
    res.json({ items: items.map((c) => c.toJSON()), total: items.length, page: 1, limit: items.length });
  }),
);
