import { Router } from "express";
import { OrderListQuerySchema, OrderSchema, OrderStatusChangeSchema, PaymentSchema } from "@motatto/shared";
import { requirePermission, requireTenant, scope, wrap } from "../middleware/auth.js";
import { parseBody, parseQuery } from "../middleware/validate.js";
import { Order } from "../models/index.js";
import { notFound, badRequest } from "../lib/errors.js";
import { imageUpload, storeFile } from "../services/storage.js";
import {
  assertEditable,
  changeStatus,
  createOrder,
  decorate,
  deductPreview,
  getOrderFull,
  invoicePayload,
  listOrders,
  payOrder,
  updateOrder,
} from "../services/orderService.js";
import { renderInvoicePdf } from "../services/pdf.js";
import { refreshUsage } from "./tenant.js";

export const ordersRouter = Router();
ordersRouter.use(requireTenant);

ordersRouter.get(
  "/",
  requirePermission("orders:read"),
  wrap(async (req, res) => {
    const q = parseQuery(OrderListQuerySchema, req);
    res.json(await listOrders(req, q));
  }),
);

ordersRouter.post(
  "/",
  requirePermission("orders:write"),
  wrap(async (req, res) => {
    const input = parseBody(OrderSchema, req);
    const order = await createOrder(req, input);
    refreshUsage(req.tenantId).catch(() => undefined);
    res.status(201).json(await decorate(req, order));
  }),
);

ordersRouter.get(
  "/:id",
  requirePermission("orders:read"),
  wrap(async (req, res) => {
    const { full } = await getOrderFull(req, req.params.id);
    res.json(full);
  }),
);

ordersRouter.patch(
  "/:id",
  requirePermission("orders:write"),
  wrap(async (req, res) => {
    const input = parseBody(OrderSchema.partial(), req);
    const order = await Order.findOne({ _id: req.params.id, ...scope(req) });
    if (!order) throw notFound("Orden");
    await updateOrder(req, order, input);
    res.json(await decorate(req, order));
  }),
);

ordersRouter.post(
  "/:id/status",
  requirePermission("orders:write"),
  wrap(async (req, res) => {
    const input = parseBody(OrderStatusChangeSchema, req);
    const order = await Order.findOne({ _id: req.params.id, ...scope(req) });
    if (!order) throw notFound("Orden");
    await changeStatus(req, order, input.status, { deduct: input.deduct, voidReason: input.voidReason });
    res.json(await decorate(req, order));
  }),
);

ordersRouter.get(
  "/:id/deduct-preview",
  requirePermission("orders:read"),
  wrap(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, ...scope(req) });
    if (!order) throw notFound("Orden");
    res.json(await deductPreview(req, order));
  }),
);

ordersRouter.post(
  "/:id/pay",
  requirePermission("orders:pay"),
  wrap(async (req, res) => {
    const input = parseBody(PaymentSchema, req);
    const order = await Order.findOne({ _id: req.params.id, ...scope(req) });
    if (!order) throw notFound("Orden");
    await payOrder(req, order, input);
    res.json(await decorate(req, order));
  }),
);

ordersRouter.post(
  "/:id/photos",
  requirePermission("orders:write"),
  imageUpload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Falta el archivo 'file'");
    const order = await Order.findOne({ _id: req.params.id, ...scope(req) });
    if (!order) throw notFound("Orden");
    assertEditable(order);
    const url = await storeFile(String(req.tenantId), req.file, `orders/${order._id}`);
    order.photos.push(url);
    await order.save();
    res.json(await decorate(req, order));
  }),
);

ordersRouter.get(
  "/:id/invoice",
  requirePermission("orders:read"),
  wrap(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, ...scope(req) });
    if (!order) throw notFound("Orden");
    res.json(await invoicePayload(req.tenant!, order));
  }),
);

ordersRouter.get(
  "/:id/pdf",
  requirePermission("orders:read"),
  wrap(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, ...scope(req) });
    if (!order) throw notFound("Orden");
    const { invoice } = await invoicePayload(req.tenant!, order);
    const pdf = await renderInvoicePdf(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${order.number}.pdf"`);
    res.send(pdf);
  }),
);
