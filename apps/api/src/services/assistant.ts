import type { Types } from "mongoose";
import { PRODUCT_CATEGORIES, type AssistantAction, type AssistantProposal, type ItemType, type ProductCategory, type VehicleKind } from "@motatto/shared";
import { Customer, Order, Product, Service, Vehicle } from "../models/index.js";
import { normalize } from "../lib/text.js";
import { aiEnabled, askClaude, extractJson, safeAsk } from "./ai.js";
import { parseSpanishNumber, splitPrice } from "./spanishNumbers.js";

interface Catalog {
  products: Array<{ id: string; name: string; reference: string; price: number; stock: number; minStock: number; compatibleWith: string[] }>;
  services: Array<{ id: string; name: string; suggestedPrice: number }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  vehicles: Array<{ id: string; customerId: string; brand: string; model: string; plate: string }>;
}

export async function loadCatalog(tenantId: Types.ObjectId): Promise<Catalog> {
  const [products, services, customers, vehicles] = await Promise.all([
    Product.find({ tenantId, active: true }).select("name reference price stock minStock compatibleWith").limit(1500),
    Service.find({ tenantId, active: true }).select("name suggestedPrice").limit(500),
    Customer.find({ tenantId }).sort({ updatedAt: -1 }).select("name phone").limit(300),
    Vehicle.find({ tenantId }).sort({ updatedAt: -1 }).select("customerId brand model plate").limit(400),
  ]);
  return {
    products: products.map((p) => ({ id: String(p._id), name: p.name, reference: p.reference, price: p.price, stock: p.stock, minStock: p.minStock, compatibleWith: p.compatibleWith })),
    services: services.map((s) => ({ id: String(s._id), name: s.name, suggestedPrice: s.suggestedPrice })),
    customers: customers.map((c) => ({ id: String(c._id), name: c.name, phone: c.phone })),
    vehicles: vehicles.map((v) => ({ id: String(v._id), customerId: String(v.customerId), brand: v.brand, model: v.model, plate: v.plate })),
  };
}

// ---------------- fuzzy matching ----------------

const STOP = new Set(["de", "la", "el", "los", "las", "un", "una", "y", "con", "para", "del", "al", "le", "lo", "por", "a", "en", "que", "mi", "su"]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}

function stem(t: string): string {
  return t.replace(/(es|s)$/, "").replace(/(a|o)$/, "");
}

/** Token-overlap similarity in [0,1], with light stemming and prefix matching. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a).map(stem);
  const tb = tokens(b).map(stem);
  if (!ta.length || !tb.length) return 0;
  const hit = (x: string, list: string[]) => list.some((y) => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x))));
  const inter = ta.filter((t) => hit(t, tb)).length;
  const interB = tb.filter((t) => hit(t, ta)).length;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (nb.includes(na) || na.includes(nb)) return Math.max(0.85, inter / Math.max(ta.length, tb.length));
  // recall on query tokens weighted more than precision on catalog tokens
  return 0.65 * (inter / ta.length) + 0.35 * (interB / tb.length);
}

type Match =
  | { kind: "product"; score: number; p: Catalog["products"][number] }
  | { kind: "service"; score: number; s: Catalog["services"][number] };

function bestMatch(text: string, cat: Catalog): Match | null {
  let best: Match | null = null;
  for (const p of cat.products) {
    const score = Math.max(similarity(text, p.name), p.reference ? similarity(text, p.reference) * 0.9 : 0);
    if (!best || score > best.score) best = { kind: "product", score, p };
  }
  for (const s of cat.services) {
    const score = similarity(text, s.name);
    if (!best || score > best.score) best = { kind: "service", score, s };
  }
  return best;
}

function splitChunks(text: string): string[] {
  return text
    .replace(/[.;\n]+/g, ",")
    .split(/,|\s+y\s+(?=(?!\w+\s+mil\b))/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Smarter split: do not break "treinta y dos mil" or "aceite y filtro" when that is a catalog name. */
function splitSmart(text: string, cat: Catalog): string[] {
  const parts = text.replace(/[.;\n]+/g, ",").split(",").map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const sub = part.split(/\s+y\s+/i);
    if (sub.length === 1) {
      out.push(part);
      continue;
    }
    // greedy merge: if joining consecutive pieces with " y " matches a catalog name better, keep together
    let i = 0;
    while (i < sub.length) {
      let cur = sub[i];
      let j = i + 1;
      while (j < sub.length) {
        const joined = `${cur} y ${sub[j]}`;
        const joinedPrice = splitPrice(joined);
        const curPrice = splitPrice(cur);
        const joinedWords = normalize(sub[j]).split(" ");
        const numericJoin = parseSpanishNumber(joinedWords[0] ?? "") !== null && /mil|lucas|\d{4,}/.test(normalize(sub[j]));
        const joinedScore = bestMatch(joinedPrice.text, cat)?.score ?? 0;
        const curScore = bestMatch(curPrice.text, cat)?.score ?? 0;
        if (numericJoin || joinedScore > curScore + 0.05) {
          cur = joined;
          j++;
        } else break;
      }
      out.push(cur);
      i = j;
    }
  }
  return out.length ? out : splitChunks(text);
}

function detectQty(chunk: string): { text: string; qty: number } {
  const m = /^(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.+)$/i.exec(chunk.trim());
  if (m) {
    const qty = /^\d+$/.test(m[1]) ? Number(m[1]) : (parseSpanishNumber(m[1]) ?? 1);
    if (qty >= 1 && qty <= 100) return { text: m[2], qty };
  }
  const m2 = /^(.+?)\s+x\s*(\d+)$/i.exec(chunk.trim());
  if (m2) return { text: m2[1], qty: Number(m2[2]) };
  return { text: chunk, qty: 1 };
}

function findCustomer(text: string, cat: Catalog): AssistantProposal["customer"] | undefined {
  const m = /(?:moto|carro|vehiculo|veh[ií]culo)\s+de\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/i.exec(text) ?? /(?:cliente|para|de)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/.exec(text);
  if (!m) return undefined;
  const name = m[1];
  let best: { c: Catalog["customers"][number]; score: number } | null = null;
  for (const c of cat.customers) {
    const score = similarity(name, c.name);
    if (!best || score > best.score) best = { c, score };
  }
  if (best && best.score >= 0.5) return { id: best.c.id, name: best.c.name, phone: best.c.phone };
  return { name };
}

function findVehicle(text: string, cat: Catalog, customerId?: string): AssistantProposal["vehicle"] | undefined {
  const plate = /placa\s*([a-z]{3}\s?-?\s?\d{2,3}[a-z]?)/i.exec(text);
  if (plate) {
    const p = plate[1].toUpperCase().replace(/[\s-]/g, "");
    const v = cat.vehicles.find((x) => x.plate.replace(/[\s-]/g, "") === p);
    return v ? { id: v.id, brand: v.brand, model: v.model, plate: v.plate } : { plate: p };
  }
  const pool = customerId ? cat.vehicles.filter((v) => v.customerId === customerId) : cat.vehicles;
  let best: { v: Catalog["vehicles"][number]; score: number } | null = null;
  for (const v of pool) {
    const full = `${v.brand} ${v.model}`;
    const n = normalize(text);
    const score = n.includes(normalize(v.model)) ? 0.9 : n.includes(normalize(v.brand)) ? 0.5 : 0;
    if (score && (!best || score > best.score)) best = { v, score };
  }
  if (best) return { id: best.v.id, brand: best.v.brand, model: best.v.model, plate: best.v.plate };
  if (customerId && pool.length === 1) return { id: pool[0].id, brand: pool[0].brand, model: pool[0].model, plate: pool[0].plate };
  return undefined;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

/** Deterministic fallback interpreter (no API key). */
export function interpretLocally(text: string, cat: Catalog): AssistantProposal {
  const n = normalize(text);
  const customer = findCustomer(text, cat);
  const vehicle = findVehicle(text, cat, customer?.id);

  if (/placa\s*[a-z]{3}/i.test(text) && !/cambio|pastilla|aceite|kit|bujia/.test(n) && (/\bque\b.*\b(hicimos|hizo|tiene)\b|historial|buscar|busca/.test(n) || n.split(" ").length <= 4)) {
    return {
      intent: "buscar_vehiculo",
      answer: vehicle?.id ? `Vehículo ${vehicle.brand} ${vehicle.model} placa ${vehicle.plate}.` : `No encontré un vehículo con la placa ${vehicle?.plate ?? ""}.`,
      vehicle,
      items: [],
      unrecognized: [],
    };
  }

  if (/\b(inventario|bajo de stock|poco stock|se me acaba|agotad)/.test(n) && !/cuanto (vale|cuesta)/.test(n)) {
    const accion = inventoryAction(cat);
    const list = accion.lowStock.slice(0, 8).map((x) => `${x.name} (${x.stock} de mínimo ${x.minStock})`).join(", ");
    return {
      intent: "consultar_inventario",
      answer: accion.lowStock.length ? `Tienes ${accion.total} productos activos. Bajo de stock o agotados: ${accion.lowStock.length}: ${list}.` : `Tienes ${accion.total} productos activos y ninguno está bajo de stock.`,
      items: [],
      unrecognized: [],
      accion,
    };
  }

  const askPrice = /cuanto (vale|cuesta|es|sale)|precio de|que precio|a como/.test(n);
  const askStock = /\b(hay|stock|cuantos|cuantas|quedan|tenemos|tengo)\b/.test(n) && !/cambio/.test(n);
  if (askPrice || askStock) {
    const cleaned = n.replace(/cuanto (vale|cuesta|es|sale)|precio de|que precio|a como|hay|en stock|stock|cuantos|cuantas|quedan|tenemos|tengo|el|la|las|los|de|del|una|un/g, " ").trim();
    const m = bestMatch(cleaned, cat);
    if (m && m.score >= 0.4) {
      if (m.kind === "product") {
        return {
          intent: askPrice ? "consultar_precio" : "consultar_stock",
          answer: `${m.p.name}: ${money(m.p.price)}, hay ${m.p.stock} en stock.`,
          items: [{ type: "repuesto", productId: m.p.id, description: m.p.name, qty: 1, unitPrice: m.p.price, confidence: m.score, matchedName: m.p.name }],
          unrecognized: [],
        };
      }
      return {
        intent: "consultar_precio",
        answer: `${m.s.name}: ${money(m.s.suggestedPrice)} (precio sugerido).`,
        items: [{ type: "servicio", serviceId: m.s.id, description: m.s.name, qty: 1, unitPrice: m.s.suggestedPrice, confidence: m.score, matchedName: m.s.name }],
        unrecognized: [],
      };
    }
    return { intent: askPrice ? "consultar_precio" : "consultar_stock", answer: "No encontré ese producto o servicio en el catálogo.", items: [], unrecognized: [cleaned] };
  }

  // crear_orden: strip customer/vehicle preamble
  let body = text;
  if (customer || vehicle) {
    body = body.replace(/^(?:la\s+|el\s+)?(?:moto|carro|veh[ií]culo)\s+de\s+[^,.]+[,.]?/i, "");
    body = body.replace(/^\s*(?:la|el)\s+[A-Za-záéíóúñ0-9 ]{2,30}[,.]/i, (m) => (vehicle && normalize(m).includes(normalize(vehicle.model ?? "~~")) ? "" : m));
    body = body.replace(/placa\s*[a-z]{3}\s?-?\s?\d{2,3}[a-z]?[,.]?/i, "");
  }
  const chunks = splitSmart(body, cat);
  const items: AssistantProposal["items"] = [];
  const unrecognized: string[] = [];
  for (const raw of chunks) {
    const { text: noPrice, price } = splitPrice(raw);
    const { text: name, qty } = detectQty(noPrice);
    if (!tokens(name).length) continue;
    const m = bestMatch(name, cat);
    if (m && m.score >= 0.45) {
      if (m.kind === "product") {
        items.push({ type: "repuesto", productId: m.p.id, description: m.p.name, qty, unitPrice: price ?? m.p.price, confidence: Math.min(1, m.score), matchedName: m.p.name });
      } else {
        items.push({ type: "servicio", serviceId: m.s.id, description: m.s.name, qty, unitPrice: price ?? m.s.suggestedPrice, confidence: Math.min(1, m.score), matchedName: m.s.name });
      }
    } else {
      const type: ItemType = /cambio|revision|ajuste|lavado|mano de obra|purga|sincroniz|instalacion|montaje/.test(normalize(name)) ? "servicio" : "otro";
      items.push({ type, description: name.trim(), qty, unitPrice: price ?? 0, confidence: m ? Math.min(0.3, m.score) : 0 });
      if (price === null) unrecognized.push(name.trim());
    }
  }
  if (!items.length) {
    return { intent: "desconocido", answer: "No entendí qué quieres hacer. Dicta los repuestos y servicios separados por comas.", customer, vehicle, items: [], unrecognized: [text] };
  }
  const total = items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const answer = `Propongo ${items.length} línea${items.length === 1 ? "" : "s"} por ${money(total)}${unrecognized.length ? `. Sin precio: ${unrecognized.join(", ")}` : ""}.`;
  return { intent: "crear_orden", answer, customer, vehicle, items, unrecognized };
}

// ---------------- Claude ----------------

/**
 * Selects the tenant data relevant to this utterance, so the model sees ~40 items instead of the whole catalog.
 * Keeps the full catalog for grounding; this only trims what is sent to the model (cost + focus).
 */
export function retrieveCandidates(text: string, cat: Catalog): Catalog {
  const score = (name: string, extra = "") => similarity(text, `${name} ${extra}`);
  const top = <T,>(items: T[], f: (x: T) => number, n: number) =>
    items.map((x) => ({ x, s: f(x) })).filter((r) => r.s > 0.2).sort((a, b) => b.s - a.s).slice(0, n).map((r) => r.x);
  const products = top(cat.products, (p) => score(p.name, `${p.reference} ${p.compatibleWith.join(" ")}`), 25);
  const services = top(cat.services, (s) => score(s.name), 12);
  const customers = top(cat.customers, (c) => score(c.name, c.phone), 6);
  const plates = normalize(text).replace(/\s+/g, "");
  const vehicles = cat.vehicles.filter((v) => (v.plate && plates.includes(normalize(v.plate).replace(/\s+/g, ""))) || customers.some((c) => c.id === v.customerId) || score(`${v.brand} ${v.model}`) > 0.4).slice(0, 8);
  return { ...cat, products, services, customers, vehicles };
}

function systemPrompt(cat: Catalog): string {
  const products = cat.products.map((p) => `- id=${p.id} | ${p.name}${p.reference ? ` (ref ${p.reference})` : ""} | precio ${p.price} | stock ${p.stock}${p.compatibleWith.length ? ` | compatible: ${p.compatibleWith.join(", ")}` : ""}`).join("\n");
  const services = cat.services.map((s) => `- id=${s.id} | ${s.name} | precio ${s.suggestedPrice}`).join("\n");
  const customers = cat.customers.slice(0, 150).map((c) => `- id=${c.id} | ${c.name}${c.phone ? ` | ${c.phone}` : ""}`).join("\n");
  const vehicles = cat.vehicles.slice(0, 200).map((v) => `- id=${v.id} | cliente=${v.customerId} | ${v.brand} ${v.model}${v.plate ? ` | placa ${v.plate}` : ""}`).join("\n");
  return `Eres el asistente de un taller de motos/carros en Colombia. Interpretas lo que dicta el mecánico o cajero (español colombiano: "pastillas", "kit de arrastre", "cunas", "purgada", "pinta", "lucas"=mil pesos) y respondes SOLO con un JSON válido con esta forma exacta:
{
  "intent": "crear_orden" | "consultar_precio" | "consultar_stock" | "buscar_vehiculo" | "crear_producto" | "crear_cliente" | "entrada_stock" | "imprimir_factura" | "consultar_inventario" | "desconocido",
  "answer": "respuesta corta en español para mostrar/leer en voz alta",
  "customer": { "id": "id del catálogo si coincide", "name": "...", "phone": "..." } | null,
  "vehicle": { "id": "id si coincide", "brand": "...", "model": "...", "plate": "..." } | null,
  "items": [ { "type": "repuesto"|"servicio"|"otro", "productId": "id o null", "serviceId": "id o null", "description": "...", "qty": 1, "unitPrice": 32000, "confidence": 0.9, "matchedName": "nombre del catálogo" } ],
  "unrecognized": ["fragmentos que no pudiste interpretar"],
  "discount": 0,
  "km": null,
  "description": "problema o trabajo solicitado si lo dictan, si no null",
  "accion": null | { "tipo": "crear_producto" | "crear_cliente" | "entrada_stock" | "imprimir_factura", "nombre": "...", "referencia": "...", "marca": "...", "categoria": "una de: ${PRODUCT_CATEGORIES.join(", ")}", "precio": 0, "costo": 0, "stock": 0, "stock_minimo": 0, "telefono": "...", "vehiculo": { "tipo": "moto" | "carro", "marca": "...", "modelo": "...", "placa": "..." }, "producto_id": "id del catálogo o null", "cantidad": 1, "costo_unitario": 0, "numero_factura": "MT-AAAA-NNNN" }
}
Reglas:
- Acciones (campo "accion"; el taller confirma antes de guardar, tú SOLO propones, nunca digas que ya quedó creado):
  - "crea/agrega un producto X a 30 mil, stock 5" → intent crear_producto, accion tipo crear_producto (nombre, precio, costo, stock, categoría, marca/referencia si las dicen). answer: "Propongo crear X a $P con stock S. ¿Lo creo?"
  - "agrega el cliente Juan, cel 300..., moto Pulsar, placa ABC12D" → intent crear_cliente, accion tipo crear_cliente con vehiculo (si dicen marca y modelo). La placa va en vehiculo.placa.
  - "llegaron 4 bujías NS 200" / "entró N de X al inventario" → intent entrada_stock, accion tipo entrada_stock con producto_id del catálogo si coincide, cantidad N, costo_unitario si lo dicen.
  - "imprime / manda / muestra la factura MT-2026-0001" → intent imprimir_factura, accion numero_factura.
  - "qué hay bajo de stock / cómo va el inventario / qué se me acaba" → intent consultar_inventario, accion null (el servidor responde con datos reales).
  - Si no es una acción, accion es null.
- Usa los precios del catálogo salvo que el usuario diga un precio ("a treinta y dos mil" = 32000, "26 mil" = 26000, "veintiséis mil" = 26000, "80 lucas" = 80000).
- Repuestos → type "repuesto" con productId. Servicios/mano de obra → "servicio" con serviceId. Lo que no esté en el catálogo → "otro" sin id (aunque sea mano de obra), unitPrice 0 si no se dijo precio, y agrégalo a unrecognized para que el usuario lo complete.
- Un repuesto y su mano de obra son DOS líneas distintas: "cambio de batería, batería a 280 mil" = línea servicio "Cambio de batería" + línea repuesto/otro "Batería" 280000. "Cambio de aceite y filtro" es UN servicio del catálogo; si además dice "aceite" o "filtro" como repuesto, esos son líneas de repuesto aparte.
- "las dos pastillas" / "pastillas delanteras y traseras" = dos líneas (delanteras y traseras). "dos bujías" = qty 2 de una línea.
- "descuento de X" / "rebájale X" → campo discount en pesos (no es una línea). "tiene N mil kilómetros" → km.
- "cuánto vale / cuánto cuesta" → consultar_precio. "hay / cuántos quedan / stock" → consultar_stock (si pregunta precio Y stock, usa consultar_precio y menciona ambos en answer). "placa XXX" sin trabajos → buscar_vehiculo.
- answer: para crear_orden describe la PROPUESTA ("Propongo N líneas por $X, con descuento de $Y"), nunca digas que ya se creó. Para consultas, responde con el dato exacto del catálogo (precio y stock).
- Montos enteros en pesos. No inventes ids ni precios de cosas fuera del catálogo.

PRODUCTOS:
${products || "(ninguno)"}

SERVICIOS:
${services || "(ninguno)"}

CLIENTES RECIENTES:
${customers || "(ninguno)"}

VEHÍCULOS RECIENTES:
${vehicles || "(ninguno)"}`;
}

const INTENTS = new Set([
  "crear_orden",
  "consultar_precio",
  "consultar_stock",
  "buscar_vehiculo",
  "crear_producto",
  "crear_cliente",
  "entrada_stock",
  "imprimir_factura",
  "consultar_inventario",
  "desconocido",
]);

/** Validates a proposed action against the catalog and the input rules. Returns undefined when unusable. */
function sanitizeAction(raw: unknown, cat: Catalog): AssistantAction | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const tipo = String(a.tipo ?? "");
  if (tipo === "crear_producto") {
    const name = str(a.nombre);
    if (!name) return undefined;
    const category: ProductCategory = PRODUCT_CATEGORIES.includes(a.categoria as ProductCategory) ? (a.categoria as ProductCategory) : "otro";
    return { kind: "crear_producto", name, reference: str(a.referencia), brand: str(a.marca), category, price: num(a.precio), cost: num(a.costo), stock: num(a.stock), minStock: num(a.stock_minimo) };
  }
  if (tipo === "crear_cliente") {
    const name = str(a.nombre);
    if (!name) return undefined;
    const v = a.vehiculo && typeof a.vehiculo === "object" ? (a.vehiculo as Record<string, unknown>) : null;
    const brand = v ? str(v.marca) : undefined;
    const model = v ? str(v.modelo) ?? "Sin especificar" : undefined;
    const plate = v ? str(v.placa)?.toUpperCase().replace(/\s+/g, "") : undefined;
    const vehicle = brand ? { kind: (v?.tipo === "carro" ? "carro" : "moto") as VehicleKind, brand, model: model!, plate } : undefined;
    return { kind: "crear_cliente", name, phone: str(a.telefono), vehicle };
  }
  if (tipo === "entrada_stock") {
    let productId = typeof a.producto_id === "string" && cat.products.some((p) => p.id === a.producto_id) ? a.producto_id : undefined;
    const name = productId ? cat.products.find((p) => p.id === productId)!.name : str(a.nombre);
    if (!name) return undefined;
    if (!productId) {
      const m = bestMatch(name, cat);
      if (m && m.kind === "product" && m.score >= 0.6) productId = m.p.id;
    }
    return { kind: "entrada_stock", productId, productName: productId ? cat.products.find((p) => p.id === productId)!.name : name, qty: num(a.cantidad) || 1, unitCost: num(a.costo_unitario) || undefined };
  }
  if (tipo === "imprimir_factura") {
    const number = str(a.numero_factura);
    return number ? { kind: "imprimir_factura", number: number.toUpperCase() } : undefined;
  }
  return undefined;
}

/** Inventory summary computed from the catalog, never from the model. */
function inventoryAction(cat: Catalog): Extract<AssistantAction, { kind: "consultar_inventario" }> {
  const lowStock = cat.products.filter((p) => p.stock <= p.minStock).map((p) => ({ name: p.name, stock: p.stock, minStock: p.minStock }));
  return { kind: "consultar_inventario", total: cat.products.length, lowStock };
}

function sanitize(raw: unknown, cat: Catalog, fallback: AssistantProposal): AssistantProposal {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const pids = new Set(cat.products.map((p) => p.id));
  const sids = new Set(cat.services.map((s) => s.id));
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items: AssistantProposal["items"] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const productId = typeof o.productId === "string" && pids.has(o.productId) ? o.productId : undefined;
    const serviceId = typeof o.serviceId === "string" && sids.has(o.serviceId) ? o.serviceId : undefined;
    const typeRaw = String(o.type ?? "");
    const type: ItemType = productId ? "repuesto" : serviceId ? "servicio" : typeRaw === "servicio" ? "servicio" : typeRaw === "repuesto" ? "repuesto" : "otro";
    // Matched catalog entries always use the catalog name (what the invoice should show).
    const description = productId
      ? cat.products.find((p) => p.id === productId)!.name
      : serviceId
        ? cat.services.find((s) => s.id === serviceId)!.name
        : typeof o.description === "string" && o.description.trim()
          ? o.description.trim()
          : "";
    if (!description) continue;
    const qty = Math.max(1, Math.min(100, Math.round(Number(o.qty) || 1)));
    let unitPrice = Math.max(0, Math.round(Number(o.unitPrice) || 0));
    if (!unitPrice && productId) unitPrice = cat.products.find((p) => p.id === productId)!.price;
    if (!unitPrice && serviceId) unitPrice = cat.services.find((s) => s.id === serviceId)!.suggestedPrice;
    const confidence = Math.max(0, Math.min(1, Number(o.confidence) || (productId || serviceId ? 0.8 : 0.3)));
    items.push({ type, productId, serviceId, description, qty, unitPrice, confidence, matchedName: typeof o.matchedName === "string" ? o.matchedName : undefined });
  }
  const c = r.customer && typeof r.customer === "object" ? (r.customer as Record<string, unknown>) : null;
  const v = r.vehicle && typeof r.vehicle === "object" ? (r.vehicle as Record<string, unknown>) : null;
  const custId = c && typeof c.id === "string" && cat.customers.some((x) => x.id === c.id) ? (c.id as string) : undefined;
  const vehId = v && typeof v.id === "string" && cat.vehicles.some((x) => x.id === v.id) ? (v.id as string) : undefined;
  return {
    intent: INTENTS.has(String(r.intent)) ? (r.intent as AssistantProposal["intent"]) : fallback.intent,
    answer: typeof r.answer === "string" && r.answer.trim() ? r.answer.trim() : fallback.answer,
    customer: c && typeof c.name === "string" ? { id: custId, name: c.name, phone: typeof c.phone === "string" ? c.phone : undefined } : fallback.customer,
    vehicle: v ? { id: vehId, brand: typeof v.brand === "string" ? v.brand : undefined, model: typeof v.model === "string" ? v.model : undefined, plate: typeof v.plate === "string" ? v.plate : undefined } : fallback.vehicle,
    items,
    unrecognized: Array.isArray(r.unrecognized) ? r.unrecognized.filter((x): x is string => typeof x === "string") : [],
    discount: Math.max(0, Math.round(Number(r.discount) || 0)) || undefined,
    km: Number(r.km) > 0 ? Math.round(Number(r.km)) : undefined,
    description: typeof r.description === "string" && r.description.trim() ? r.description.trim() : undefined,
    accion: sanitizeAction(r.accion, cat),
  };
}

/** For price/stock questions, rebuild the answer from the catalog so numbers are never hallucinated. */
function groundAnswer(p: AssistantProposal, cat: Catalog): AssistantProposal {
  const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;
  if (p.intent === "consultar_inventario") {
    const accion = inventoryAction(cat);
    const list = accion.lowStock.slice(0, 8).map((x) => `${x.name} (${x.stock} de mínimo ${x.minStock})`).join(", ");
    const answer = accion.lowStock.length
      ? `Tienes ${accion.total} productos activos. Bajo de stock o agotados: ${accion.lowStock.length}: ${list}.`
      : `Tienes ${accion.total} productos activos y ninguno está bajo de stock.`;
    return { ...p, accion, answer };
  }
  if (p.intent === "crear_orden") {
    if (!p.items.length) return p;
    const subtotal = p.items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
    const pending = p.items.filter((i) => !i.unitPrice).length;
    const who = [p.customer?.name, p.vehicle && [p.vehicle.brand, p.vehicle.model].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const parts = [
      `Propongo ${p.items.length} línea${p.items.length === 1 ? "" : "s"}${who ? ` para ${who}` : ""}: subtotal ${fmt(subtotal)}`,
      p.discount ? `descuento ${fmt(p.discount)}` : "",
      p.discount ? `total ${fmt(Math.max(0, subtotal - p.discount))}` : "",
      pending ? `${pending} sin precio, complétalo` : "",
    ].filter(Boolean);
    return { ...p, answer: parts.join(", ") + "." };
  }
  if (p.intent !== "consultar_precio" && p.intent !== "consultar_stock") return p;
  const prods = p.items.filter((i) => i.productId).map((i) => cat.products.find((x) => x.id === i.productId)!);
  const servs = p.items.filter((i) => i.serviceId).map((i) => cat.services.find((x) => x.id === i.serviceId)!);
  if (!prods.length && !servs.length) {
    // Sin coincidencia en el catálogo: nunca dejar que el modelo afirme precios o stock.
    return { ...p, answer: "No encontré ese producto o servicio en tu catálogo. Revisa el nombre o agrégalo en Inventario." };
  }
  const parts = [
    ...prods.map((x) => `${x.name}: ${fmt(x.price)}, ${x.stock > 0 ? `hay ${x.stock} en stock` : "sin stock"}`),
    ...servs.map((x) => `${x.name}: ${fmt(x.suggestedPrice)} (mano de obra)`),
  ];
  return { ...p, answer: parts.join(". ") + "." };
}

export async function interpret(
  tenantId: Types.ObjectId,
  text: string,
  context?: { customerId?: string; vehicleId?: string },
): Promise<AssistantProposal> {
  const cat = await loadCatalog(tenantId);
  const local = interpretLocally(text, cat);
  if (context?.customerId && !local.customer?.id) {
    const c = cat.customers.find((x) => x.id === context.customerId);
    if (c) local.customer = { id: c.id, name: c.name, phone: c.phone };
  }
  if (context?.vehicleId && !local.vehicle?.id) {
    const v = cat.vehicles.find((x) => x.id === context.vehicleId);
    if (v) local.vehicle = { id: v.id, brand: v.brand, model: v.model, plate: v.plate };
  }
  // Ahorro de créditos: si el buscador local resolvió una consulta sencilla, no se llama al modelo.
  const resolvedLocally =
    (local.intent === "consultar_precio" || local.intent === "consultar_stock") && local.items.some((i) => i.productId || i.serviceId) ||
    local.intent === "consultar_inventario" ||
    (local.intent === "buscar_vehiculo" && !!local.vehicle?.id);
  if (!aiEnabled() || resolvedLocally) return local;
  const ctxLine = context ? `\nContexto en pantalla: ${JSON.stringify(context)}` : "";
  const text_ = await safeAsk(() => askClaude(`Texto dictado: """${text}"""${ctxLine}\nResponde solo el JSON.`, systemPrompt(retrieveCandidates(text, cat)), 2000), "");
  const parsed = extractJson(text_);
  const grounded = groundAnswer(sanitize(parsed, cat, local), cat);
  // Si el modelo no ubicó el producto/servicio en el catálogo pero el buscador local sí, usar el local.
  const priceQuery = grounded.intent === "consultar_precio" || grounded.intent === "consultar_stock";
  const hasMatch = (p: AssistantProposal) => p.items.some((i) => i.productId || i.serviceId);
  const result = priceQuery && !hasMatch(grounded) && hasMatch(local) ? groundAnswer(local, cat) : grounded;
  if (result.accion?.kind === "imprimir_factura") {
    const order = await Order.findOne({ tenantId, number: result.accion.number }).select("_id").lean();
    if (order) result.accion = { ...result.accion, orderId: String(order._id) };
    else result.answer = `No encontré la factura ${result.accion.number} en tu taller.`;
  }
  if (context?.customerId && !result.customer?.id) result.customer = local.customer;
  if (context?.vehicleId && !result.vehicle?.id) result.vehicle = local.vehicle;
  return result;
}
