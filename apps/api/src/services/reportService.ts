import type { Types } from "mongoose";
import ExcelJS from "exceljs";
import { PAYMENT_METHODS, type PaymentMethod, type ReportSales } from "@motatto/shared";
import { Customer, Order, Payment } from "../models/index.js";
import { eachDay, rangeOf, toDayString } from "../lib/dates.js";

export async function salesReport(tenantId: Types.ObjectId, from: string, to: string): Promise<ReportSales & { orders: Array<Record<string, unknown>> }> {
  const { start, end } = rangeOf(from, to);
  const orders = await Order.find({ tenantId, status: "pagada", paidAt: { $gte: start, $lt: end } }).sort({ paidAt: 1 });
  const payments = await Payment.find({ tenantId, voided: false, createdAt: { $gte: start, $lt: end } });

  const byDayMap = new Map<string, { sales: number; orders: number }>();
  for (const d of eachDay(from, to)) byDayMap.set(d, { sales: 0, orders: 0 });
  const products = new Map<string, { productId: string; name: string; qty: number; sales: number }>();
  const services = new Map<string, { serviceId?: string; name: string; qty: number; sales: number }>();
  const customers = new Map<string, { customerId: string; orders: number; sales: number }>();
  let totalSales = 0;
  let totalCost = 0;

  for (const o of orders) {
    totalSales += o.total;
    const day = toDayString(o.paidAt!);
    const d = byDayMap.get(day) ?? { sales: 0, orders: 0 };
    d.sales += o.total;
    d.orders += 1;
    byDayMap.set(day, d);
    const c = customers.get(String(o.customerId)) ?? { customerId: String(o.customerId), orders: 0, sales: 0 };
    c.orders += 1;
    c.sales += o.total;
    customers.set(c.customerId, c);
    for (const it of o.items) {
      if (it.productId) {
        totalCost += it.qty * (it.unitCost ?? 0);
        const k = String(it.productId);
        const p = products.get(k) ?? { productId: k, name: it.description, qty: 0, sales: 0 };
        p.qty += it.qty;
        p.sales += it.total;
        products.set(k, p);
      } else {
        const k = it.serviceId ? String(it.serviceId) : `n:${it.description.toLowerCase()}`;
        const s = services.get(k) ?? { serviceId: it.serviceId ? String(it.serviceId) : undefined, name: it.description, qty: 0, sales: 0 };
        s.qty += it.qty;
        s.sales += it.total;
        services.set(k, s);
      }
    }
  }
  const byMethodMap = new Map<PaymentMethod, number>(PAYMENT_METHODS.map((m) => [m, 0]));
  for (const p of payments) byMethodMap.set(p.method as PaymentMethod, (byMethodMap.get(p.method as PaymentMethod) ?? 0) + p.amount);

  const custDocs = await Customer.find({ tenantId, _id: { $in: [...customers.keys()] } }).select("name");
  const cname = new Map(custDocs.map((c) => [String(c._id), c.name]));

  return {
    from,
    to,
    totalSales,
    totalCost,
    profit: totalSales - totalCost,
    ordersCount: orders.length,
    byDay: [...byDayMap.entries()].map(([date, v]) => ({ date, ...v })),
    byMethod: [...byMethodMap.entries()].map(([method, amount]) => ({ method, amount })),
    topProducts: [...products.values()].sort((a, b) => b.sales - a.sales).slice(0, 20),
    topServices: [...services.values()].sort((a, b) => b.sales - a.sales).slice(0, 20),
    topCustomers: [...customers.values()]
      .map((c) => ({ ...c, name: cname.get(c.customerId) ?? "" }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 20),
    orders: orders.map((o) => ({
      number: o.number,
      paidAt: o.paidAt?.toISOString(),
      customer: cname.get(String(o.customerId)) ?? "",
      subtotal: o.subtotal,
      discount: o.discount,
      surcharge: o.surcharge,
      total: o.total,
      method: o.surchargeMethod,
    })),
  };
}

export async function salesReportXlsx(tenantId: Types.ObjectId, from: string, to: string): Promise<Buffer> {
  const r = await salesReport(tenantId, from, to);
  const wb = new ExcelJS.Workbook();
  const bold = (ws: ExcelJS.Worksheet) => (ws.getRow(1).font = { bold: true });

  const s1 = wb.addWorksheet("Resumen");
  s1.columns = [{ header: "Concepto", key: "k", width: 28 }, { header: "Valor", key: "v", width: 18 }];
  s1.addRows([
    { k: "Desde", v: r.from },
    { k: "Hasta", v: r.to },
    { k: "Ventas", v: r.totalSales },
    { k: "Costo repuestos", v: r.totalCost },
    { k: "Utilidad", v: r.profit },
    { k: "Órdenes pagadas", v: r.ordersCount },
    ...r.byMethod.map((m) => ({ k: `Pagos ${m.method}`, v: m.amount })),
  ]);
  bold(s1);

  const s2 = wb.addWorksheet("Ventas por día");
  s2.columns = [{ header: "Fecha", key: "date", width: 14 }, { header: "Ventas", key: "sales", width: 16 }, { header: "Órdenes", key: "orders", width: 10 }];
  s2.addRows(r.byDay);
  bold(s2);

  const s3 = wb.addWorksheet("Órdenes");
  s3.columns = [
    { header: "Número", key: "number", width: 16 },
    { header: "Pagada", key: "paidAt", width: 22 },
    { header: "Cliente", key: "customer", width: 28 },
    { header: "Subtotal", key: "subtotal", width: 14 },
    { header: "Descuento", key: "discount", width: 12 },
    { header: "Recargo", key: "surcharge", width: 12 },
    { header: "Total", key: "total", width: 14 },
    { header: "Método", key: "method", width: 14 },
  ];
  s3.addRows(r.orders);
  bold(s3);

  const s4 = wb.addWorksheet("Productos");
  s4.columns = [{ header: "Producto", key: "name", width: 36 }, { header: "Cantidad", key: "qty", width: 10 }, { header: "Ventas", key: "sales", width: 16 }];
  s4.addRows(r.topProducts);
  s4.addRow({});
  s4.addRow({ name: "SERVICIOS" }).font = { bold: true };
  s4.addRows(r.topServices);
  bold(s4);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
