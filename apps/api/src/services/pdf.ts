import PDFDocument from "pdfkit";
import { formatDate, formatDateTime, formatMoney, PAYMENT_METHOD_LABEL, type PublicInvoice } from "@motatto/shared";
import { stripEmoji } from "../lib/text.js";

const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

/** Renders the invoice as an A4 PDF buffer. Built-in Helvetica covers Latin-1 (Spanish accents). */
export function renderInvoicePdf(inv: PublicInvoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Cuenta de cobro ${inv.number}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const t = inv.tenant;
    const clean = (s?: string) => stripEmoji(s ?? "");
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    // Header
    doc.font(FONT_BOLD).fontSize(18).text(clean(t.name).toUpperCase(), { align: "center" });
    doc.font(FONT).fontSize(10);
    if (t.slogan) doc.text(clean(t.slogan), { align: "center" });
    if (t.address) doc.text(clean(t.address), { align: "center" });
    if (t.phone) doc.text(`Teléfono: ${clean(t.phone)}`, { align: "center" });
    doc.moveDown();
    hr(doc, left, width);

    // Invoice meta
    doc.moveDown(0.5);
    doc.font(FONT_BOLD).fontSize(13).text(`CUENTA DE COBRO ${inv.number}`);
    doc.font(FONT).fontSize(10).text(`Generada el: ${formatDateTime(inv.createdAt)}`);
    if (inv.paidAt) doc.text(`Pagada el: ${formatDateTime(inv.paidAt)}`);
    if (inv.status === "anulada") doc.font(FONT_BOLD).fillColor("#b00").text("ANULADA").fillColor("#000").font(FONT);
    doc.moveDown(0.5);

    // Customer
    doc.font(FONT_BOLD).text("Cliente:");
    doc.font(FONT);
    const veh = [inv.vehicle.brand, inv.vehicle.model, inv.vehicle.plate].filter(Boolean).join(" ");
    doc.text(`${clean(inv.customer.name)} — ${clean(veh)}`);
    if (inv.km) doc.text(`Kilometraje: ${inv.km.toLocaleString("es-CO")} km`);
    doc.moveDown();

    // Items table
    const colQty = left + width - 200;
    const colUnit = left + width - 150;
    const colTotal = left + width - 70;
    let y = doc.y;
    doc.font(FONT_BOLD);
    doc.text("Descripción", left, y, { width: colQty - left - 6 });
    doc.text("Cant.", colQty, y, { width: 40, align: "right" });
    doc.text("Unitario", colUnit, y, { width: 70, align: "right" });
    doc.text(`Valor (${t.currency})`, colTotal, y, { width: 70, align: "right" });
    doc.font(FONT);
    y = doc.y + 4;
    hr(doc, left, width, y);
    y += 6;
    for (const it of inv.items) {
      if (y > doc.page.height - 140) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      const h = doc.heightOfString(clean(it.description), { width: colQty - left - 6 });
      doc.text(clean(it.description), left, y, { width: colQty - left - 6 });
      doc.text(String(it.qty), colQty, y, { width: 40, align: "right" });
      doc.text(formatMoney(it.unitPrice), colUnit, y, { width: 70, align: "right" });
      doc.text(formatMoney(it.total), colTotal, y, { width: 70, align: "right" });
      y += Math.max(h, 12) + 4;
    }
    hr(doc, left, width, y);
    y += 8;

    // Totals
    const totalLine = (label: string, value: string, bold = false) => {
      doc.font(bold ? FONT_BOLD : FONT);
      doc.text(label, colUnit - 80, y, { width: 150, align: "right" });
      doc.text(value, colTotal, y, { width: 70, align: "right" });
      y += 14;
    };
    if (inv.discount > 0 || inv.surcharge > 0) totalLine("Subtotal", formatMoney(inv.subtotal));
    if (inv.discount > 0) totalLine("Descuento", `-${formatMoney(inv.discount)}`);
    if (inv.surcharge > 0) {
      const m = inv.surchargeMethod ? PAYMENT_METHOD_LABEL[inv.surchargeMethod] : "pago";
      const pct = t.surcharges.find((s) => s.method === inv.surchargeMethod)?.pct;
      totalLine(`Recargo ${m}${pct ? ` (${pct}%)` : ""}`, formatMoney(inv.surcharge));
    }
    doc.fontSize(12);
    totalLine("TOTAL", formatMoney(inv.total), true);
    doc.fontSize(10).font(FONT);
    y += 8;

    // Payment methods
    doc.x = left;
    doc.y = y;
    doc.font(FONT_BOLD).text("Métodos de pago:", left, y, { width });
    doc.font(FONT);
    doc.text("- Efectivo", { width });
    if (t.paymentInfo) {
      const sur = t.surcharges.filter((s) => s.pct > 0);
      const note = sur.length
        ? ` (Los pagos por ${sur.map((s) => PAYMENT_METHOD_LABEL[s.method]).join("/")} tienen un cargo adicional del ${sur.map((s) => `${s.pct}%`).join("/")})`
        : "";
      doc.text(`- Transferencia bancaria: ${clean(t.paymentInfo)}${note}`, { width });
    }
    doc.moveDown();

    // Warranty
    if (t.warrantyText) {
      doc.font(FONT_BOLD).text("Política de garantía:", { width });
      doc.font(FONT).fontSize(9).text(clean(t.warrantyText), { width });
      doc.fontSize(10);
    }
    if (inv.warrantyUntil) doc.font(FONT_BOLD).text(`Garantía vigente hasta: ${formatDate(inv.warrantyUntil)}`, { width });
    doc.font(FONT);
    if (t.footerText) {
      doc.moveDown();
      doc.text(clean(t.footerText), { width, align: "center" });
    }
    doc.end();
  });
}

function hr(doc: PDFKit.PDFDocument, x: number, width: number, y?: number) {
  const yy = y ?? doc.y;
  doc.moveTo(x, yy).lineTo(x + width, yy).lineWidth(0.5).strokeColor("#999").stroke().strokeColor("#000");
  if (y === undefined) doc.moveDown(0.3);
}
