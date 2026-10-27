import type { Request } from "express";
import { Types } from "mongoose";
import { nanoid } from "nanoid";
import {
  computeTotals,
  ORDER_TRANSITIONS,
  renderInvoiceText,
  whatsappLink,
  type OrderInput,
  type OrderItemInput,
  type OrderStatus,
  type PaymentInput,
  type PaymentMethod,
  type PublicInvoice,
} from "@motatto/shared";
import { hasPerm, scope, uid } from "../middleware/auth.js";
import { AppError, badRequest, conflict, notFound } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { addDays, rangeOf } from "../lib/dates.js";
import { searchRegex } from "../lib/text.js";
import { config } from "../config.js";
import {
  Customer,
  nextSequence,
  Order,
  Payment,
  Product,
  Service,
  StockMovement,
  Vehicle,
  type OrderDoc,
  type TenantDoc,
} from "../models/index.js";

type Deduct = Array<{ productId: string; qty: number }>;

const LOCKED: OrderStatus[] = ["pagada", "anulada"];

export function assertEditable(order: OrderDoc): void {
  if (LOCKED.includes(order.status as OrderStatus)) {
    throw conflict("La orden está pagada o anulada y no se puede editar", "ORDER_LOCKED");
  }
}

export async function nextOrderNumber(tenant: TenantDoc): Promise<string> {
  const year = new Date().getFullYear();
  const key = tenant.settings.invoiceYearReset === false ? "all" : String(year);
  const seq = await nextSequence(tenant._id, key);
  const prefix = (tenant.settings.invoicePrefix || "MT").toUpperCase();
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

type PrevItem = { _id?: unknown; productId?: unknown; serviceId?: unknown; unitPrice: number };

/** Resolves order items: copies description/cost from catalog, enforces price/discount permissions. */
export async function buildItems(req: Request, inputs: OrderItemInput[], previous: readonly PrevItem[] = []) {
  const canPrice = hasPerm(req, "orders:price");
  const productIds = inputs.filter((i) => i.productId).map((i) => i.productId!);
  const serviceIds = inputs.filter((i) => i.serviceId).map((i) => i.serviceId!);
  const [products, services] = await Promise.all([
    productIds.length ? Product.find({ ...scope(req), _id: { $in: productIds } }) : [],
    serviceIds.length ? Service.find({ ...scope(req), _id: { $in: serviceIds } }) : [],
  ]);
  const pMap = new Map(products.map((p) => [String(p._id), p]));
  const sMap = new Map(services.map((s) => [String(s._id), s]));

  return inputs.map((i, pos) => {
    let unitPrice = i.unitPrice;
    let unitCost: number | undefined;
    let description = i.description;
    if (i.productId) {
      const p = pMap.get(i.productId);
      if (!p) throw notFound("Producto");
      unitCost = p.cost;
      if (!description) description = p.name;
      if (!canPrice) unitPrice = p.price;
    } else if (i.serviceId) {
      const s = sMap.get(i.serviceId);
      if (!s) throw notFound("Servicio");
      if (!description) description = s.name;
      if (!canPrice) unitPrice = s.suggestedPrice;
    } else if (!canPrice) {
      // Línea libre sin permiso de precio: conserva el precio que ya tenía (por id) o queda en 0.
      const prev = i.id ? previous.find((x) => String(x._id) === i.id && !x.productId && !x.serviceId) : undefined;
      unitPrice = prev?.unitPrice ?? 0;
    }
    const qty = i.qty ?? 1;
    return {
      ...(i.id && Types.ObjectId.isValid(i.id) ? { _id: new Types.ObjectId(i.id) } : {}),
      type: i.type,
      productId: i.productId ? new Types.ObjectId(i.productId) : undefined,
      serviceId: i.serviceId ? new Types.ObjectId(i.serviceId) : undefined,
      description,
      qty,
      unitPrice,
      unitCost,
      total: qty * unitPrice,
      pos,
    };
  });
}

export function surchargePct(tenant: TenantDoc, method?: PaymentMethod | null): number {
  if (!method) return 0;
  const s = tenant.settings.surcharges?.find((x) => x.method === method);
  return s ? s.pct : 0;
}

export function recomputeTotals(order: OrderDoc, tenant: TenantDoc): void {
  const pct = surchargePct(tenant, order.surchargeMethod as PaymentMethod | undefined);
  const t = computeTotals(
    order.items.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice })),
    order.discount ?? 0,
    pct,
  );
  order.subtotal = t.subtotal;
  order.discount = t.discount;
  order.surcharge = t.surcharge;
  order.total = t.total;
}

async function assertCustomerVehicle(req: Request, customerId: string, vehicleId: string) {
  const [c, v] = await Promise.all([
    Customer.findOne({ _id: customerId, ...scope(req) }),
    Vehicle.findOne({ _id: vehicleId, ...scope(req) }),
  ]);
  if (!c) throw notFound("Cliente");
  if (!v) throw notFound("Vehículo");
  if (String(v.customerId) !== String(c._id)) throw badRequest("El vehículo no pertenece a ese cliente", "VEHICLE_MISMATCH");
  return { customer: c, vehicle: v };
}

export async function createOrder(req: Request, input: OrderInput): Promise<OrderDoc> {
  const tenant = req.tenant!;
  const { vehicle } = await assertCustomerVehicle(req, input.customerId, input.vehicleId);
  const items = await buildItems(req, input.items);
  const discount = hasPerm(req, "orders:discount") ? input.discount : 0;
  if (input.warrantyOfOrderId && !(await Order.exists({ _id: input.warrantyOfOrderId, ...scope(req) }))) {
    throw notFound("Orden de garantía");
  }
  const order = new Order({
    ...scope(req),
    number: await nextOrderNumber(tenant),
    publicToken: newPublicToken(),
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    km: input.km,
    description: input.description ?? "",
    status: "recibida",
    items,
    discount,
    photos: input.photos,
    internalNotes: input.internalNotes ?? "",
    warrantyOfOrderId: input.warrantyOfOrderId,
    source: input.source,
    voiceTranscript: input.voiceTranscript,
    createdBy: uid(req),
    assignedTo: input.assignedTo,
  });
  recomputeTotals(order, tenant);
  await order.save();
  if (input.km !== undefined && input.km > (vehicle.lastKm ?? 0)) {
    vehicle.lastKm = input.km;
    await vehicle.save();
  }
  return order;
}

export async function updateOrder(req: Request, order: OrderDoc, input: Partial<OrderInput>): Promise<OrderDoc> {
  assertEditable(order);
  const tenant = req.tenant!;
  const before = order.toJSON();
  const customerId = input.customerId ?? String(order.customerId);
  const vehicleId = input.vehicleId ?? String(order.vehicleId);
  if (input.customerId || input.vehicleId) {
    await assertCustomerVehicle(req, customerId, vehicleId);
    order.customerId = new Types.ObjectId(customerId);
    order.vehicleId = new Types.ObjectId(vehicleId);
  }
  if (input.items) {
    const items = await buildItems(req, input.items, order.items);
    order.set("items", items);
  }
  if (input.discount !== undefined) {
    if (hasPerm(req, "orders:discount")) order.discount = input.discount;
  }
  if (input.km !== undefined) order.km = input.km;
  if (input.description !== undefined) order.description = input.description;
  if (input.internalNotes !== undefined) order.internalNotes = input.internalNotes;
  if (input.photos !== undefined) order.set("photos", input.photos);
  if (input.assignedTo !== undefined) order.assignedTo = new Types.ObjectId(input.assignedTo);
  if (input.source !== undefined) order.source = input.source;
  if (input.voiceTranscript !== undefined) order.voiceTranscript = input.voiceTranscript;
  if (input.warrantyOfOrderId !== undefined) order.warrantyOfOrderId = new Types.ObjectId(input.warrantyOfOrderId);
  recomputeTotals(order, tenant);
  await order.save();
  const priceChanged = JSON.stringify(before.items) !== JSON.stringify(order.toJSON().items) || before.discount !== order.discount;
  if (priceChanged) await audit(req, "order.update", "order", order._id, { items: before.items, discount: before.discount }, { items: order.toJSON().items, discount: order.discount });
  return order;
}

/** Lines of type repuesto with productId not yet deducted. */
export async function deductPreview(req: Request, order: OrderDoc) {
  const done = new Set(order.stockDeducted.map((d) => String(d.productId)));
  const pending = new Map<string, number>();
  for (const it of order.items) {
    if (it.productId && !done.has(String(it.productId))) {
      const k = String(it.productId);
      pending.set(k, (pending.get(k) ?? 0) + it.qty);
    }
  }
  if (!pending.size) return [];
  const products = await Product.find({ ...scope(req), _id: { $in: [...pending.keys()] } });
  return products.map((p) => {
    const qty = pending.get(String(p._id)) ?? 0;
    return { productId: String(p._id), name: p.name, qty, stock: p.stock, after: p.stock - qty };
  });
}

/** Creates salida movements and decrements stock; skips products already deducted. */
export async function applyDeduct(req: Request, order: OrderDoc, deduct: Deduct | undefined): Promise<void> {
  if (!deduct?.length) return;
  const done = new Set(order.stockDeducted.map((d) => String(d.productId)));
  // Validate every pending line before touching stock, so a bad line never leaves a partial deduction.
  const needed = new Map<string, number>();
  for (const d of deduct) if (!done.has(d.productId)) needed.set(d.productId, (needed.get(d.productId) ?? 0) + d.qty);
  if (needed.size) {
    const stocks = await Product.find({ ...scope(req), _id: { $in: [...needed.keys()] } }).select("name stock");
    const byId = new Map(stocks.map((p) => [String(p._id), p]));
    for (const [id, qty] of needed) {
      const p = byId.get(id);
      if (!p) throw notFound("Producto");
      if (p.stock < qty) {
        throw conflict(`Stock insuficiente de "${p.name}": hay ${p.stock} y se piden ${qty}`, "INSUFFICIENT_STOCK");
      }
    }
  }
  for (const d of deduct) {
    if (done.has(d.productId)) continue;
    const product = await Product.findOneAndUpdate(
      { _id: d.productId, ...scope(req) },
      { $inc: { stock: -d.qty } },
      { new: true },
    );
    if (!product) throw notFound("Producto");
    const mv = await StockMovement.create({
      ...scope(req),
      productId: product._id,
      type: "salida",
      qty: -d.qty,
      unitCost: product.cost,
      orderId: order._id,
      note: `Orden ${order.number}`,
      userId: uid(req),
    });
    order.stockDeducted.push({ productId: product._id, qty: d.qty, movementId: mv._id });
    done.add(d.productId);
  }
}

async function restoreStock(req: Request, order: OrderDoc): Promise<void> {
  for (const d of order.stockDeducted) {
    const product = await Product.findOneAndUpdate(
      { _id: d.productId, ...scope(req) },
      { $inc: { stock: d.qty } },
      { new: true },
    );
    if (!product) continue;
    await StockMovement.create({
      ...scope(req),
      productId: product._id,
      type: "devolucion",
      qty: d.qty,
      unitCost: product.cost,
      orderId: order._id,
      note: `Anulación orden ${order.number}`,
      userId: uid(req),
    });
  }
}

export async function changeStatus(
  req: Request,
  order: OrderDoc,
  status: OrderStatus,
  opts: { deduct?: Deduct; voidReason?: string },
): Promise<OrderDoc> {
  const from = order.status as OrderStatus;
  if (status === "pagada") throw badRequest("Para marcar como pagada usa el cobro (/pay)", "USE_PAY");
  if (!ORDER_TRANSITIONS[from].includes(status)) {
    throw conflict(`No se puede pasar de ${from} a ${status}`, "BAD_TRANSITION");
  }
  if (status === "anulada") {
    if (!hasPerm(req, "orders:void")) throw new AppError(403, "FORBIDDEN", "No tienes permiso para anular");
    if (!opts.voidReason?.trim()) throw badRequest("Indica el motivo de la anulación", "VOID_REASON_REQUIRED");
    const before = order.toJSON();
    if (order.stockDeducted.length) await restoreStock(req, order);
    await Payment.updateMany({ ...scope(req), orderId: order._id }, { $set: { voided: true } });
    order.status = "anulada";
    order.voidedAt = new Date();
    order.voidedBy = uid(req);
    order.voidReason = opts.voidReason.trim();
    await order.save();
    await audit(req, "order.void", "order", order._id, { status: before.status }, { status: "anulada", voidReason: order.voidReason });
    return order;
  }
  if (status === "terminada") {
    if (!hasPerm(req, "orders:finish")) throw new AppError(403, "FORBIDDEN", "No tienes permiso para terminar órdenes");
    await applyDeduct(req, order, opts.deduct);
  }
  order.status = status;
  await order.save();
  return order;
}

const PAYABLE: OrderStatus[] = ["recibida", "cotizada", "en_proceso", "terminada"];

export async function payOrder(req: Request, order: OrderDoc, input: PaymentInput) {
  const tenant = req.tenant!;
  if (!PAYABLE.includes(order.status as OrderStatus)) {
    throw conflict(`No se puede cobrar una orden en estado ${order.status}`, "BAD_TRANSITION");
  }
  const before = order.toJSON();
  order.surchargeMethod = input.method;
  recomputeTotals(order, tenant);
  const amount = input.amount ?? order.total;
  // Overpaying is allowed (cash change); underpaying would mark the order paid with money missing.
  // Checked before any stock is deducted so a rejected payment leaves nothing half-applied.
  if (amount < order.total) {
    throw badRequest(`El monto cobrado ($${amount}) es menor al total de la orden ($${order.total})`, "AMOUNT_BELOW_TOTAL");
  }
  await applyDeduct(req, order, input.deduct);
  const payment = await Payment.create({
    ...scope(req),
    orderId: order._id,
    method: input.method,
    amount,
    surcharge: order.surcharge,
    reference: input.reference ?? "",
    userId: uid(req),
    voided: false,
  });
  const now = new Date();
  order.status = "pagada";
  order.paidAt = now;
  order.warrantyUntil = addDays(now, tenant.settings.warrantyDays ?? 0);
  await order.save();
  await audit(req, "order.pay", "order", order._id, { status: before.status }, { status: "pagada", paymentId: String(payment._id), amount, method: input.method });
  return { order, payment };
}

export async function getOrderFull(req: Request, id: string) {
  const order = await Order.findOne({ _id: id, ...scope(req) });
  if (!order) throw notFound("Orden");
  return { order, full: await decorate(req, order) };
}

export async function decorate(req: Request, order: OrderDoc) {
  const [customer, vehicle, payments] = await Promise.all([
    Customer.findOne({ _id: order.customerId, ...scope(req) }),
    Vehicle.findOne({ _id: order.vehicleId, ...scope(req) }),
    Payment.find({ ...scope(req), orderId: order._id }).sort({ createdAt: 1 }),
  ]);
  const json = order.toJSON() as unknown as Record<string, unknown>;
  if (!hasPerm(req, "inventory:cost")) {
    json.items = (json.items as Array<Record<string, unknown>>).map((i) => {
      const { unitCost: _c, ...rest } = i;
      return rest;
    });
  }
  return {
    ...json,
    customer: customer ? { id: String(customer._id), name: customer.name, phone: customer.phone } : undefined,
    vehicle: vehicle
      ? { id: String(vehicle._id), kind: vehicle.kind, brand: vehicle.brand, model: vehicle.model, plate: vehicle.plate }
      : undefined,
    payments: payments.map((p) => p.toJSON()),
  };
}

export async function listOrders(
  req: Request,
  q: { status?: OrderStatus; q?: string; customerId?: string; vehicleId?: string; from?: string; to?: string; page: number; limit: number },
) {
  const filter: Record<string, unknown> = { ...scope(req) };
  if (q.status) filter.status = q.status;
  if (q.customerId) filter.customerId = q.customerId;
  if (q.vehicleId) filter.vehicleId = q.vehicleId;
  if (q.from || q.to) {
    const range = rangeOf(q.from ?? "2000-01-01", q.to ?? "2100-01-01");
    filter.createdAt = { $gte: range.start, $lt: range.end };
  }
  if (q.q) {
    const rx = searchRegex(q.q);
    const [customers, vehicles] = await Promise.all([
      Customer.find({ ...scope(req), $or: [{ name: rx }, { phone: rx }] }).select("_id"),
      Vehicle.find({ ...scope(req), $or: [{ plate: rx }, { model: rx }, { brand: rx }] }).select("_id"),
    ]);
    filter.$or = [
      { number: rx },
      { description: rx },
      { "items.description": rx },
      { customerId: { $in: customers.map((c) => c._id) } },
      { vehicleId: { $in: vehicles.map((v) => v._id) } },
    ];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit),
    Order.countDocuments(filter),
  ]);
  const items = await Promise.all(orders.map((o) => decorate(req, o)));
  return { items, total, page: q.page, limit: q.limit };
}

export function buildPublicInvoice(
  tenant: TenantDoc,
  order: OrderDoc,
  customer: { name: string } | null,
  vehicle: { kind: string; brand: string; model: string; plate?: string } | null,
): PublicInvoice {
  const s = tenant.settings;
  return {
    number: order.number,
    createdAt: (order.createdAt as Date).toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : undefined,
    status: order.status as OrderStatus,
    tenant: {
      name: tenant.name,
      slogan: s.slogan || undefined,
      address: s.address || tenant.address || undefined,
      phone: s.phone || tenant.phone || undefined,
      logoUrl: s.logoUrl || undefined,
      paymentInfo: s.paymentInfo ?? "",
      surcharges: (s.surcharges ?? []).map((x) => ({ method: x.method as PaymentMethod, pct: x.pct })),
      warrantyText: s.warrantyText ?? "",
      footerText: s.footerText ?? "",
      currency: s.currency ?? "COP",
    },
    customer: { name: customer?.name ?? "" },
    vehicle: {
      kind: (vehicle?.kind ?? "moto") as PublicInvoice["vehicle"]["kind"],
      brand: vehicle?.brand ?? "",
      model: vehicle?.model ?? "",
      plate: vehicle?.plate || undefined,
    },
    km: order.km ?? undefined,
    items: order.items.map((i) => ({
      description: i.description,
      qty: i.qty,
      unitPrice: i.unitPrice,
      total: i.total,
      type: i.type as PublicInvoice["items"][number]["type"],
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    surcharge: order.surcharge,
    surchargeMethod: (order.surchargeMethod as PaymentMethod) || undefined,
    total: order.total,
    warrantyUntil: order.warrantyUntil ? order.warrantyUntil.toISOString() : undefined,
  };
}

/** Clave del link público: aleatoria (144 bits), no se deduce del slug ni del número consecutivo. */
export const newPublicToken = (): string => nanoid(24);

/** Devuelve la clave pública de la orden; a las órdenes anteriores a la clave se les asigna una (una sola vez). */
export async function ensurePublicToken(order: OrderDoc): Promise<string> {
  if (order.publicToken) return order.publicToken;
  await Order.updateOne({ _id: order._id, publicToken: null }, { $set: { publicToken: newPublicToken() } });
  const saved = await Order.findById(order._id).select("publicToken").lean();
  if (!saved?.publicToken) throw notFound("Orden");
  order.publicToken = saved.publicToken;
  return saved.publicToken;
}

export async function invoicePayload(tenant: TenantDoc, order: OrderDoc) {
  const [customer, vehicle] = await Promise.all([
    Customer.findOne({ _id: order.customerId, tenantId: tenant._id }),
    Vehicle.findOne({ _id: order.vehicleId, tenantId: tenant._id }),
  ]);
  const invoice = buildPublicInvoice(tenant, order, customer, vehicle);
  const text = renderInvoiceText(invoice);
  return {
    invoice,
    text,
    whatsappUrl: whatsappLink(customer?.phone, text),
    publicUrl: `${config.webUrl}/cc/${tenant.slug}/${order.number}?k=${await ensurePublicToken(order)}`,
  };
}
