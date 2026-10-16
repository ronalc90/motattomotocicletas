import type { PublicInvoice } from "./types.js";
import { PAYMENT_METHOD_LABEL } from "./enums.js";

export function formatMoney(n: number, currency = "COP"): string {
  const s = Math.round(Math.abs(n)).toLocaleString("es-CO");
  return (n < 0 ? "-" : "") + (currency === "COP" ? s : `${s} ${currency}`);
}

export function formatDateTime(iso: string, tz = "America/Bogota"): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDate(iso: string, tz = "America/Bogota"): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

const SEP = "----------------------------------------";

function pad(left: string, right: string, width = 40): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

/**
 * Plain-text invoice, same layout the workshop already sends on WhatsApp.
 * Used by both the API (wa.me link) and the web (copy button).
 */
export function renderInvoiceText(inv: PublicInvoice): string {
  const t = inv.tenant;
  const lines: string[] = [];
  lines.push(t.name.toUpperCase());
  if (t.slogan) lines.push(t.slogan);
  if (t.address) lines.push(t.address);
  if (t.phone) lines.push(`Teléfono: ${t.phone}`);
  lines.push("");
  lines.push(SEP);
  lines.push(`CUENTA DE COBRO ${inv.number}`);
  lines.push(`Generada el: ${formatDateTime(inv.createdAt)}`);
  lines.push("");
  lines.push("Cliente:");
  const veh = [inv.vehicle.brand, inv.vehicle.model, inv.vehicle.plate].filter(Boolean).join(" ");
  lines.push(`${inv.customer.name} — ${veh}`);
  if (inv.km) lines.push(`Kilometraje: ${inv.km.toLocaleString("es-CO")} km`);
  lines.push("");
  lines.push(pad("Descripción", "Valor (COP)"));
  for (const it of inv.items) {
    const desc = it.qty > 1 ? `${it.description} x${it.qty}` : it.description;
    lines.push(pad(desc, formatMoney(it.total)));
  }
  lines.push(SEP);
  if (inv.discount > 0) lines.push(pad("Descuento", `-${formatMoney(inv.discount)}`));
  if (inv.surcharge > 0) {
    const m = inv.surchargeMethod ? PAYMENT_METHOD_LABEL[inv.surchargeMethod] : "pago";
    const pct = t.surcharges.find((s) => s.method === inv.surchargeMethod)?.pct;
    lines.push(pad(`Recargo ${m}${pct ? ` (${pct}%)` : ""}`, formatMoney(inv.surcharge)));
  }
  lines.push(`TOTAL: ${formatMoney(inv.total)}`);
  lines.push("");
  lines.push("Métodos de Pago:");
  lines.push("- Efectivo");
  if (t.paymentInfo) {
    const sur = t.surcharges.filter((s) => s.pct > 0);
    const note = sur.length
      ? ` (⚠️ Los pagos por ${sur.map((s) => PAYMENT_METHOD_LABEL[s.method]).join("/")} tienen un cargo adicional del ${sur
          .map((s) => `${s.pct}%`)
          .join("/")})`
      : "";
    lines.push(`- Transferencia bancaria: ${t.paymentInfo}${note}`);
  }
  lines.push("");
  lines.push(SEP);
  if (t.warrantyText) {
    lines.push("Política de Garantía:");
    lines.push(t.warrantyText.trim());
  }
  if (inv.warrantyUntil) lines.push(`Garantía vigente hasta: ${formatDate(inv.warrantyUntil)}`);
  if (t.footerText) lines.push(t.footerText);
  lines.push(SEP);
  lines.push(`🛵 ${t.name.toUpperCase()} 🔑`);
  return lines.join("\n");
}

export function whatsappLink(phone: string | undefined, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `57${digits}` : digits;
  const base = withCountry ? `https://wa.me/${withCountry}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function computeTotals(
  items: Array<{ qty: number; unitPrice: number }>,
  discount: number,
  surchargePct: number,
): { subtotal: number; discount: number; surcharge: number; total: number } {
  const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const d = Math.min(discount, subtotal);
  const base = subtotal - d;
  const surcharge = Math.round((base * surchargePct) / 100);
  return { subtotal, discount: d, surcharge, total: base + surcharge };
}
