import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { DEFAULT_FOOTER_TEXT, DEFAULT_WARRANTY_TEXT, SERVICES_MOTOS, computeTotals } from "@motatto/shared";
import { config } from "../config.js";
import { Counter, Customer, Order, Payment, Product, Service, StockMovement, Tenant, User, Vehicle } from "../models/index.js";
import { addDays } from "../lib/dates.js";
import { logger } from "../lib/logger.js";

const DEMO_PRODUCTS = [
  { name: "Bujía central NS 200", reference: "JG351209", brand: "Bajaj", category: "bujias", compatibleWith: ["NS 200", "NS 160"], cost: 18000, price: 32000, stock: 4, minStock: 2 },
  { name: "Kit arrastre Gixxer 250", reference: "", brand: "Suzuki", category: "transmision", compatibleWith: ["Gixxer 250"], cost: 200000, price: 274000, stock: 1, minStock: 1 },
  { name: "Aceite 20W50", reference: "", brand: "", category: "lubricantes", compatibleWith: [], cost: 45000, price: 65000, stock: 6, minStock: 2 },
  { name: "Filtro de aceite", reference: "", brand: "", category: "filtros", compatibleWith: [], cost: 9000, price: 16000, stock: 5, minStock: 2 },
  { name: "Pastillas delanteras Gixxer 250", reference: "", brand: "", category: "frenos", compatibleWith: ["Gixxer 250"], cost: 15000, price: 26000, stock: 3, minStock: 1 },
  { name: "Pastillas traseras Gixxer 250", reference: "", brand: "", category: "frenos", compatibleWith: ["Gixxer 250"], cost: 18000, price: 30000, stock: 3, minStock: 1 },
  { name: "Cunas de dirección", reference: "", brand: "", category: "suspension", compatibleWith: [], cost: 40000, price: 65000, stock: 2, minStock: 1 },
] as const;

export interface SeedResult {
  superadmin: string;
  tenant: string;
  owner: string;
  created: { products: number; services: number; order?: string };
}

/** Idempotent demo seed: superadmin + tenant "motatto" with catalog, customer, vehicle and one paid order. */
export async function runSeed(): Promise<SeedResult> {
  const result: SeedResult = { superadmin: config.superadminEmail, tenant: "motatto", owner: "dirox7@gmail.com", created: { products: 0, services: 0 } };

  if (!(await User.exists({ email: config.superadminEmail }))) {
    await User.create({
      tenantId: null,
      name: "Superadmin",
      email: config.superadminEmail,
      passwordHash: await bcrypt.hash(config.superadminPassword, 10),
      role: "superadmin",
      active: true,
    });
    logger.info("seed: superadmin created");
  }

  let tenant = await Tenant.findOne({ slug: "motatto" });
  if (!tenant) {
    tenant = await Tenant.create({
      slug: "motatto",
      name: "Motatto Motocicletas",
      type: "motos",
      city: "Bogotá",
      phone: "321 422 9804",
      address: "Calle 5A Sur # 85-25",
      email: "dirox7@gmail.com",
      plan: "pro",
      status: "activo",
      settings: {
        slogan: "Especialistas en Mantenimiento y Reparación de Motos 🛠️",
        address: "Calle 5A Sur # 85-25",
        phone: "321 422 9804",
        currency: "COP",
        invoicePrefix: "MT",
        invoiceYearReset: true,
        surcharges: [{ method: "nequi", pct: 3 }],
        warrantyDays: 9,
        warrantyText: DEFAULT_WARRANTY_TEXT,
        footerText: DEFAULT_FOOTER_TEXT,
        paymentInfo: "Nequi 321 422 9804",
        askStockOnClose: true,
      },
    });
    logger.info("seed: tenant created");
  }
  const tenantId = tenant._id;

  let owner = await User.findOne({ email: "dirox7@gmail.com" });
  if (!owner) {
    owner = await User.create({
      tenantId,
      name: "Ronal",
      email: "dirox7@gmail.com",
      passwordHash: await bcrypt.hash(config.seedOwnerPassword, 10),
      role: "dueno",
      active: true,
    });
    logger.info("seed: owner created");
  }

  for (const s of SERVICES_MOTOS) {
    const exists = await Service.exists({ tenantId, name: s.name });
    if (!exists) {
      await Service.create({ tenantId, ...s, active: true });
      result.created.services++;
    }
  }

  const productIds = new Map<string, Types.ObjectId>();
  for (const p of DEMO_PRODUCTS) {
    let doc = await Product.findOne({ tenantId, name: p.name });
    if (!doc) {
      doc = await Product.create({ tenantId, ...p, compatibleWith: [...p.compatibleWith], active: true });
      await StockMovement.create({ tenantId, productId: doc._id, type: "entrada", qty: p.stock, unitCost: p.cost, note: "Stock inicial", userId: owner._id });
      result.created.products++;
    }
    productIds.set(p.name, doc._id);
  }

  let customer = await Customer.findOne({ tenantId, phone: "3214229804" });
  if (!customer) customer = await Customer.create({ tenantId, name: "Ronal", phone: "3214229804" });
  let vehicle = await Vehicle.findOne({ tenantId, plate: "ABC123" });
  if (!vehicle) {
    vehicle = await Vehicle.create({ tenantId, customerId: customer._id, kind: "moto", brand: "Suzuki", model: "Gixxer 250", plate: "ABC123" });
    await Customer.updateOne({ _id: customer._id }, { $addToSet: { vehicleIds: vehicle._id } });
  }

  const hasOrder = await Order.exists({ tenantId, customerId: customer._id });
  if (!hasOrder) {
    const svc = async (name: string) => (await Service.findOne({ tenantId, name }))!;
    const prod = (name: string) => productIds.get(name)!;
    const pcost = async (name: string) => (await Product.findById(prod(name)))!.cost;
    const lines: Array<{ type: "repuesto" | "servicio"; productId?: Types.ObjectId; serviceId?: Types.ObjectId; description: string; unitPrice: number; unitCost?: number }> = [
      { type: "repuesto", productId: prod("Kit arrastre Gixxer 250"), description: "Kit arrastre Gixxer 250", unitPrice: 274000, unitCost: await pcost("Kit arrastre Gixxer 250") },
      { type: "repuesto", productId: prod("Aceite 20W50"), description: "Aceite 20W50", unitPrice: 65000, unitCost: await pcost("Aceite 20W50") },
      { type: "servicio", serviceId: (await svc("Pinta"))._id, description: "Pinta", unitPrice: 25000 },
      { type: "repuesto", productId: prod("Pastillas traseras Gixxer 250"), description: "Pastillas traseras", unitPrice: 30000, unitCost: await pcost("Pastillas traseras Gixxer 250") },
      { type: "repuesto", productId: prod("Pastillas delanteras Gixxer 250"), description: "Pastillas delanteras", unitPrice: 26000, unitCost: await pcost("Pastillas delanteras Gixxer 250") },
      { type: "repuesto", productId: prod("Cunas de dirección"), description: "Cunas de dirección", unitPrice: 65000, unitCost: await pcost("Cunas de dirección") },
      { type: "servicio", serviceId: (await svc("Cambio cunas de dirección"))._id, description: "Cambio cunas de dirección", unitPrice: 100000 },
      { type: "servicio", serviceId: (await svc("Cambio kit de arrastre"))._id, description: "Cambio kit de arrastre", unitPrice: 25000 },
      { type: "repuesto", productId: prod("Filtro de aceite"), description: "Filtro de aceite", unitPrice: 16000, unitCost: await pcost("Filtro de aceite") },
      { type: "servicio", serviceId: (await svc("Cambio de pastillas"))._id, description: "Cambio de pastillas", unitPrice: 10000 },
      { type: "servicio", serviceId: (await svc("Cambio de aceite y filtro"))._id, description: "Cambio de aceite y filtro", unitPrice: 10000 },
      { type: "servicio", serviceId: (await svc("Purga de frenos"))._id, description: "Purgada de frenos", unitPrice: 70000 },
    ];
    const items = lines.map((l, pos) => ({ ...l, qty: 1, total: l.unitPrice, pos }));
    const totals = computeTotals(items, 0, 0);
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate({ tenantId, key: String(year) }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    const number = `MT-${year}-${String(counter!.seq).padStart(4, "0")}`;
    const paidAt = new Date();
    const order = new Order({
      tenantId,
      number,
      customerId: customer._id,
      vehicleId: vehicle._id,
      description: "Mantenimiento general",
      status: "pagada",
      items,
      subtotal: totals.subtotal,
      discount: 0,
      surcharge: 0,
      surchargeMethod: "efectivo",
      total: totals.total,
      paidAt,
      warrantyUntil: addDays(paidAt, 9),
      source: "manual",
      createdBy: owner._id,
    });
    // Deduct stock for product lines
    for (const it of items) {
      if (!it.productId) continue;
      await Product.updateOne({ _id: it.productId }, { $inc: { stock: -1 } });
      const mv = await StockMovement.create({ tenantId, productId: it.productId, type: "salida", qty: -1, unitCost: it.unitCost, orderId: order._id, note: `Orden ${number}`, userId: owner._id });
      order.stockDeducted.push({ productId: it.productId, qty: 1, movementId: mv._id });
    }
    await order.save();
    await Payment.create({ tenantId, orderId: order._id, method: "efectivo", amount: totals.total, surcharge: 0, userId: owner._id, voided: false });
    result.created.order = number;
    logger.info({ number, total: totals.total }, "seed: demo order created");
  }

  const [usersCount, productsCount] = await Promise.all([User.countDocuments({ tenantId, active: true }), Product.countDocuments({ tenantId, active: true })]);
  await Tenant.updateOne({ _id: tenantId }, { $set: { "usage.usersCount": usersCount, "usage.productsCount": productsCount } });
  return result;
}
