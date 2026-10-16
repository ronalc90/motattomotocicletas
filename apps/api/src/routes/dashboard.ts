import { Router } from "express";
import { requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { Order, Product } from "../models/index.js";
import { dayRange, monthStart, toDayString } from "../lib/dates.js";
import { dayData } from "../services/cashService.js";
import { decorate } from "../services/orderService.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireTenant, requirePermission("orders:read"));

dashboardRouter.get(
  "/",
  wrap(async (req, res) => {
    const today = toDayString();
    const { start, end } = dayRange(today);
    const ms = monthStart();
    const [open, { totals }, ordersPaidToday, lowStock, warranties, monthAgg] = await Promise.all([
      Order.find({ ...scope(req), status: { $in: ["recibida", "cotizada", "en_proceso", "terminada"] } }).sort({ createdAt: -1 }).limit(30),
      dayData(req.tenantId!, today),
      Order.countDocuments({ ...scope(req), status: "pagada", paidAt: { $gte: start, $lt: end } }),
      Product.find({ ...scope(req), active: true, $expr: { $lte: ["$stock", "$minStock"] } }).sort({ stock: 1 }).limit(20),
      Order.find({ ...scope(req), status: "pagada", warrantyUntil: { $gte: new Date() } }).sort({ warrantyUntil: 1 }).limit(20),
      Order.aggregate([
        { $match: { ...scope(req), status: "pagada", paidAt: { $gte: ms } } },
        { $group: { _id: null, sales: { $sum: "$total" }, orders: { $sum: 1 } } },
      ]),
    ]);
    const [openOrders, activeWarranties] = await Promise.all([
      Promise.all(open.map((o) => decorate(req, o))),
      Promise.all(warranties.map((o) => decorate(req, o))),
    ]);
    res.json({
      openOrders,
      today: { sales: totals.sales, payments: totals.sales, expenses: totals.expenses, ordersPaid: ordersPaidToday },
      lowStock: lowStock.map((p) => p.toJSON()),
      activeWarranties,
      month: { sales: monthAgg[0]?.sales ?? 0, orders: monthAgg[0]?.orders ?? 0 },
    });
  }),
);
