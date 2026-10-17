import { PRODUCT_CATEGORIES, type LabelReadResult, type ProductCategory } from "@motatto/shared";
import { aiEnabled, askClaudeWithImage, extractJson, safeAsk } from "./ai.js";
import { aiOverLimit } from "../lib/aiUsage.js";
import { Product } from "../models/index.js";
import type { Types } from "mongoose";

const EMPTY: LabelReadResult = { rawText: "", confidence: 0, compatibleWith: [] };

const PROMPT = `Eres un asistente de un taller de motos y carros en Colombia. Lee la etiqueta o empaque de repuesto en la imagen y devuelve SOLO un JSON (sin texto adicional) con esta forma:
{
  "reference": "referencia o código de parte impreso (ej. JG351209)",
  "barcode": "código de barras (solo dígitos) si se ve",
  "name": "nombre corto del producto en español (ej. Bujía central NS 200)",
  "brand": "marca (ej. Bajaj, Suzuki, NGK)",
  "category": "una de: ${PRODUCT_CATEGORIES.join(", ")}",
  "compatibleWith": ["modelos de vehículo compatibles que estén IMPRESOS o que puedas inferir con alta certeza por la marca/referencia (ej. Bajaj → Pulsar NS 200, Boxer; Suzuki → Gixxer). Si dudas, []"],
  "printedPrice": número entero del precio impreso en la etiqueta (puede estar en otra moneda, ej. MRP ₹ de India; devuelve el número tal cual), si no null,
  "printedCurrency": "moneda del precio impreso si se distingue (COP, INR, USD...), si no null",
  "manufacturedOn": "fecha de fabricación si aparece (YYYY-MM-DD o texto), si no null",
  "rawText": "todo el texto legible de la etiqueta",
  "confidence": número entre 0 y 1 de qué tan seguro estás
}
Si un campo no se ve, usa null (o [] para compatibleWith). El "name" debe ser útil para buscar en un inventario colombiano: tipo de repuesto + modelo si se sabe (ej. "Bujía central NS 200", "Pastillas delanteras Gixxer 250").`;

interface Raw {
  reference?: string | null;
  barcode?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  compatibleWith?: unknown;
  printedPrice?: unknown;
  manufacturedOn?: string | null;
  printedCurrency?: string | null;
  rawText?: string | null;
  confidence?: unknown;
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

export async function readLabel(
  tenantId: Types.ObjectId,
  file: { buffer: Buffer; mimetype: string },
): Promise<LabelReadResult & { note?: string }> {
  if (!aiEnabled()) return { ...EMPTY, note: "IA no configurada" };
  if (await aiOverLimit(tenantId)) return { ...EMPTY, note: "Límite mensual de IA alcanzado" };
  const text = await safeAsk(() => askClaudeWithImage(PROMPT, file, undefined, String(tenantId)), "");
  const raw = extractJson<Raw>(text);
  if (!raw) return { ...EMPTY, rawText: text.slice(0, 2000) };

  const category = PRODUCT_CATEGORIES.includes(raw.category as ProductCategory)
    ? (raw.category as ProductCategory)
    : undefined;
  const compatibleWith = Array.isArray(raw.compatibleWith)
    ? raw.compatibleWith.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  const printedPrice =
    typeof raw.printedPrice === "number"
      ? Math.round(raw.printedPrice)
      : typeof raw.printedPrice === "string" && /\d/.test(raw.printedPrice)
        ? Number(raw.printedPrice.replace(/[^\d]/g, ""))
        : undefined;
  const confidence = typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5;

  const result: LabelReadResult = {
    reference: str(raw.reference),
    barcode: str(raw.barcode)?.replace(/\s+/g, ""),
    name: str(raw.name),
    brand: str(raw.brand),
    category,
    compatibleWith,
    printedPrice,
    manufacturedOn: str(raw.manufacturedOn),
    printedCurrency: str(raw.printedCurrency),
    rawText: str(raw.rawText) ?? "",
    confidence,
  };

  const or: Record<string, unknown>[] = [];
  if (result.barcode) or.push({ barcode: result.barcode });
  if (result.reference) or.push({ reference: new RegExp(`^${result.reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (or.length) {
    const existing = await Product.findOne({ tenantId, active: true, $or: or }).select("_id");
    if (existing) result.existingProductId = String(existing._id);
  }
  return result;
}
