import { Router } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { ListQuerySchema, PRODUCT_CATEGORIES, ProductSchema, StockAdjustSchema, StockMovementSchema, type ProductCategory } from "@motatto/shared";
import { hasPerm, requirePermission, requireTenant, scope, uid, wrap } from "../middleware/auth.js";
import { parseBody, parseQuery } from "../middleware/validate.js";
import { Expense, Product, StockMovement, type ProductDoc } from "../models/index.js";
import { badRequest, notFound } from "../lib/errors.js";
import { escapeRegex, normalize, searchRegex } from "../lib/text.js";
import { audit } from "../lib/audit.js";
import { toDayString } from "../lib/dates.js";
import { imageUpload, sheetUpload, storeFile } from "../services/storage.js";
import { readLabel } from "../services/labelReader.js";
import { refreshUsage } from "./tenant.js";

export const productsRouter = Router();
productsRouter.use(requireTenant);

const ProductQuery = ListQuerySchema.extend({
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  lowStock: z.string().optional(),
  includeInactive: z.string().optional(),
});

export function present(req: Parameters<typeof scope>[0], p: ProductDoc) {
  const json = p.toJSON() as unknown as Record<string, unknown>;
  delete json.lastLabelOcr;
  if (!hasPerm(req, "inventory:cost")) delete json.cost;
  return json;
}

/** Movimiento de stock sin el costo unitario para quien no tiene inventory:cost. */
function presentMovement(req: Parameters<typeof scope>[0], m: { toJSON(): unknown }) {
  const json = m.toJSON() as Record<string, unknown>;
  if (!hasPerm(req, "inventory:cost")) delete json.unitCost;
  return json;
}

function searchFilter(q: string): Record<string, unknown> {
  const rx = searchRegex(q);
  return { $or: [{ name: rx }, { reference: rx }, { barcode: rx }, { brand: rx }, { compatibleWith: rx }] };
}

productsRouter.get(
  "/",
  requirePermission("inventory:read"),
  wrap(async (req, res) => {
    const q = parseQuery(ProductQuery, req);
    const filter: Record<string, unknown> = { ...scope(req) };
    if (!q.includeInactive) filter.active = true;
    if (q.category) filter.category = q.category;
    if (q.lowStock) filter.$expr = { $lte: ["$stock", "$minStock"] };
    if (q.q) Object.assign(filter, searchFilter(q.q));
    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ name: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Product.countDocuments(filter),
    ]);
    res.json({ items: items.map((p) => present(req, p)), total, page: q.page, limit: q.limit });
  }),
);

productsRouter.get(
  "/low-stock",
  requirePermission("inventory:read"),
  wrap(async (req, res) => {
    const items = await Product.find({ ...scope(req), active: true, $expr: { $lte: ["$stock", "$minStock"] } }).sort({ stock: 1 });
    res.json({ items: items.map((p) => present(req, p)), total: items.length, page: 1, limit: items.length });
  }),
);

productsRouter.get(
  "/export",
  requirePermission("inventory:read"),
  wrap(async (req, res) => {
    const showCost = hasPerm(req, "inventory:cost");
    const items = await Product.find({ ...scope(req), active: true }).sort({ name: 1 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventario");
    ws.columns = [
      { header: "nombre", key: "nombre", width: 36 },
      { header: "referencia", key: "referencia", width: 16 },
      { header: "codigo", key: "codigo", width: 16 },
      { header: "marca", key: "marca", width: 14 },
      { header: "categoria", key: "categoria", width: 14 },
      { header: "compatible", key: "compatible", width: 24 },
      ...(showCost ? [{ header: "costo", key: "costo", width: 12 }] : []),
      { header: "precio", key: "precio", width: 12 },
      { header: "stock", key: "stock", width: 8 },
      { header: "stock_minimo", key: "stock_minimo", width: 12 },
      { header: "ubicacion", key: "ubicacion", width: 14 },
    ];
    for (const p of items) {
      ws.addRow({
        nombre: p.name,
        referencia: p.reference,
        codigo: p.barcode,
        marca: p.brand,
        categoria: p.category,
        compatible: p.compatibleWith.join(", "),
        costo: p.cost,
        precio: p.price,
        stock: p.stock,
        stock_minimo: p.minStock,
        ubicacion: p.location,
      });
    }
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="inventario-${toDayString()}.xlsx"`);
    res.send(Buffer.from(buf));
  }),
);

productsRouter.post(
  "/read-label",
  requirePermission("inventory:entry"),
  imageUpload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Falta el archivo 'file'");
    res.json(await readLabel(req.tenantId!, req.file));
  }),
);

// ---------- import ----------
const CATEGORY_ALIASES: Record<string, ProductCategory> = {
  bujia: "bujias",
  bujias: "bujias",
  freno: "frenos",
  frenos: "frenos",
  lubricante: "lubricantes",
  lubricantes: "lubricantes",
  aceite: "lubricantes",
  aceites: "lubricantes",
  filtro: "filtros",
  filtros: "filtros",
  transmision: "transmision",
  suspension: "suspension",
  direccion: "suspension",
  electrico: "electrico",
  electricos: "electrico",
  llanta: "llantas",
  llantas: "llantas",
  motor: "motor",
  carroceria: "carroceria",
  accesorio: "accesorios",
  accesorios: "accesorios",
  otro: "otro",
  otros: "otro",
};

function toCategory(v: unknown): ProductCategory {
  const n = normalize(String(v ?? ""));
  return CATEGORY_ALIASES[n] ?? (PRODUCT_CATEGORIES.includes(n as ProductCategory) ? (n as ProductCategory) : "otro");
}

function toInt(v: unknown): number {
  if (typeof v === "number") return Math.round(v);
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  const sep = text.split("\n")[0]?.includes(";") && !text.split("\n")[0]?.includes(",") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function readRows(file: Express.Multer.File): Promise<Record<string, string>[]> {
  let matrix: string[][];
  if (/\.csv$/i.test(file.originalname) || file.mimetype.includes("csv")) {
    matrix = parseCsv(file.buffer.toString("utf8").replace(/^﻿/, ""));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    matrix = [];
    ws.eachRow((r) => {
      const vals: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) vals.push(cellText(r.getCell(c).value));
      matrix.push(vals);
    });
  }
  if (!matrix.length) return [];
  const header = matrix[0].map((h) => normalize(h).replace(/\s+/g, "_"));
  return matrix.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").toString().trim()])));
}

productsRouter.post(
  "/import",
  requirePermission("inventory:manage"),
  sheetUpload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Falta el archivo 'file'");
    const rows = await readRows(req.file);
    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = r.nombre || r.name || r.producto;
      if (!name) {
        errors.push({ row: i + 2, message: "Falta el nombre" });
        continue;
      }
      try {
        const data = {
          name,
          reference: r.referencia || r.ref || "",
          barcode: r.codigo || r.codigo_de_barras || r.barcode || "",
          brand: r.marca || "",
          category: toCategory(r.categoria),
          compatibleWith: (r.compatible || r.compatible_con || "")
            .split(/[,;|]/)
            .map((s) => s.trim())
            .filter(Boolean),
          cost: toInt(r.costo),
          price: toInt(r.precio),
          minStock: r.stock_minimo !== undefined && r.stock_minimo !== "" ? toInt(r.stock_minimo) : 1,
          location: r.ubicacion || "",
        };
        const stock = toInt(r.stock);
        const match: Record<string, unknown>[] = [];
        if (data.reference) match.push({ reference: new RegExp(`^${escapeRegex(data.reference)}$`, "i") });
        if (data.barcode) match.push({ barcode: data.barcode });
        match.push({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
        const existing = await Product.findOne({ ...scope(req), $or: match });
        if (existing) {
          const delta = stock - existing.stock;
          existing.set({ ...data, active: true });
          if (r.stock !== undefined && r.stock !== "" && delta !== 0) {
            existing.stock = stock;
            await StockMovement.create({ ...scope(req), productId: existing._id, type: "ajuste", qty: delta, unitCost: data.cost, note: "Importación", userId: uid(req) });
          }
          await existing.save();
          updated++;
        } else {
          const p = await Product.create({ ...scope(req), ...data, stock, active: true });
          if (stock > 0) {
            await StockMovement.create({ ...scope(req), productId: p._id, type: "entrada", qty: stock, unitCost: data.cost, note: "Importación", userId: uid(req) });
          }
          created++;
        }
      } catch (e) {
        errors.push({ row: i + 2, message: (e as Error).message });
      }
    }
    await audit(req, "products.import", "product", undefined, undefined, { created, updated, errors: errors.length });
    refreshUsage(req.tenantId).catch(() => undefined);
    res.json({ created, updated, errors });
  }),
);

productsRouter.post(
  "/",
  requirePermission("inventory:entry"),
  wrap(async (req, res) => {
    const input = parseBody(ProductSchema, req);
    const { initialStock, ...data } = input;
    const p = await Product.create({ ...scope(req), ...data, stock: initialStock ?? 0 });
    if (initialStock && initialStock > 0) {
      await StockMovement.create({ ...scope(req), productId: p._id, type: "entrada", qty: initialStock, unitCost: p.cost, note: "Stock inicial", userId: uid(req) });
    }
    refreshUsage(req.tenantId).catch(() => undefined);
    res.status(201).json(present(req, p));
  }),
);

productsRouter.get(
  "/:id",
  requirePermission("inventory:read"),
  wrap(async (req, res) => {
    const p = await Product.findOne({ _id: req.params.id, ...scope(req) });
    if (!p) throw notFound("Producto");
    const movements = await StockMovement.find({ ...scope(req), productId: p._id }).sort({ createdAt: -1 }).limit(200);
    res.json({ ...present(req, p), movements: movements.map((m) => presentMovement(req, m)) });
  }),
);

productsRouter.patch(
  "/:id",
  requirePermission("inventory:entry"),
  wrap(async (req, res) => {
    const input = parseBody(ProductSchema.partial(), req);
    const p = await Product.findOne({ _id: req.params.id, ...scope(req) });
    if (!p) throw notFound("Producto");
    const { initialStock: _ignored, ...data } = input;
    const manage = hasPerm(req, "inventory:manage");
    if (!manage) {
      // mecanico can edit descriptive fields but not sale price / cost
      delete (data as Record<string, unknown>).price;
      delete (data as Record<string, unknown>).cost;
      delete (data as Record<string, unknown>).active;
    }
    const before = { price: p.price, cost: p.cost };
    p.set(data);
    await p.save();
    if (before.price !== p.price || before.cost !== p.cost) {
      await audit(req, "product.price_change", "product", p._id, before, { price: p.price, cost: p.cost });
    }
    res.json(present(req, p));
  }),
);

productsRouter.delete(
  "/:id",
  requirePermission("inventory:manage"),
  wrap(async (req, res) => {
    const p = await Product.findOneAndUpdate({ _id: req.params.id, ...scope(req) }, { active: false }, { new: true });
    if (!p) throw notFound("Producto");
    refreshUsage(req.tenantId).catch(() => undefined);
    res.json(present(req, p));
  }),
);

productsRouter.post(
  "/:id/movements",
  requirePermission("inventory:entry"),
  wrap(async (req, res) => {
    const input = parseBody(StockMovementSchema, req);
    const p = await Product.findOne({ _id: req.params.id, ...scope(req) });
    if (!p) throw notFound("Producto");
    if (input.type === "ajuste" && !hasPerm(req, "inventory:manage")) throw badRequest("Solo dueño/admin pueden hacer ajustes", "FORBIDDEN");
    if (input.type === "entrada" && input.qty <= 0) throw badRequest("La cantidad de una entrada debe ser mayor que 0");
    // Sin inventory:cost no se fija el costo; registrar el gasto exige además cash:write (igual que en la interfaz).
    const canCost = hasPerm(req, "inventory:cost");
    const inputCost = canCost ? input.unitCost : undefined;
    const registerExpense = input.registerExpense && canCost && hasPerm(req, "cash:write");
    const unitCost = inputCost ?? p.cost;
    const mv = await StockMovement.create({
      ...scope(req),
      productId: p._id,
      type: input.type,
      qty: input.qty,
      unitCost,
      supplier: input.supplier ?? "",
      note: input.note ?? "",
      photoUrl: input.photoUrl ?? "",
      userId: uid(req),
    });
    const before = p.stock;
    p.stock += input.qty;
    if (input.type === "entrada" && inputCost !== undefined) p.cost = inputCost;
    await p.save();
    let expense: unknown;
    if (input.type === "entrada" && registerExpense && unitCost > 0) {
      const e = await Expense.create({
        ...scope(req),
        concept: `Compra ${p.name} x${input.qty}${input.supplier ? ` (${input.supplier})` : ""}`,
        category: "repuestos",
        amount: input.qty * unitCost,
        date: toDayString(),
        movementId: mv._id,
        receiptPhotoUrl: input.photoUrl ?? "",
        userId: uid(req),
      });
      expense = e.toJSON();
    }
    await audit(req, `stock.${input.type}`, "product", p._id, { stock: before }, { stock: p.stock, qty: input.qty, movementId: String(mv._id) });
    res.status(201).json({ ...present(req, p), movement: presentMovement(req, mv), expense });
  }),
);

productsRouter.post(
  "/:id/adjust",
  requirePermission("inventory:manage"),
  wrap(async (req, res) => {
    const input = parseBody(StockAdjustSchema, req);
    const p = await Product.findOne({ _id: req.params.id, ...scope(req) });
    if (!p) throw notFound("Producto");
    const delta = input.countedQty - p.stock;
    const before = p.stock;
    let movement: unknown = null;
    if (delta !== 0) {
      const mv = await StockMovement.create({ ...scope(req), productId: p._id, type: "ajuste", qty: delta, unitCost: p.cost, note: input.note ?? "Conteo", userId: uid(req) });
      movement = mv.toJSON();
      p.stock = input.countedQty;
      await p.save();
    }
    await audit(req, "stock.ajuste", "product", p._id, { stock: before }, { stock: p.stock, delta });
    res.json({ ...present(req, p), movement, delta });
  }),
);

productsRouter.post(
  "/:id/photos",
  requirePermission("inventory:entry"),
  imageUpload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest("Falta el archivo 'file'");
    const p = await Product.findOne({ _id: req.params.id, ...scope(req) });
    if (!p) throw notFound("Producto");
    const source = ["label", "shelf", "other"].includes(String(req.body?.source)) ? String(req.body.source) : "other";
    const url = await storeFile(String(req.tenantId), req.file, `products/${p._id}`);
    p.photos.push({ url, source: source as "label" | "shelf" | "other", at: new Date() });
    await p.save();
    res.json(present(req, p));
  }),
);
