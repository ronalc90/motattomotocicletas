import { Document, Page, StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import type { PublicInvoice } from "@motatto/shared";
import { PAYMENT_METHOD_LABEL, formatDate, formatDateTime, formatMoney, ORDER_STATUS_LABEL } from "@motatto/shared";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  tenant: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 9, color: "#475569" },
  logo: { width: 64, height: 64, objectFit: "contain" },
  band: { backgroundColor: "#0f172a", color: "#fff", padding: 10, borderRadius: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  bandTitle: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  grid: { flexDirection: "row", gap: 16, marginBottom: 14 },
  box: { flex: 1, padding: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6 },
  label: { fontSize: 8, color: "#64748b", marginBottom: 2 },
  val: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  th: { fontSize: 8, color: "#64748b", fontFamily: "Helvetica-Bold" },
  cDesc: { flex: 1 },
  cQty: { width: 36, textAlign: "right" },
  cPrice: { width: 80, textAlign: "right" },
  cTotal: { width: 80, textAlign: "right" },
  totals: { marginTop: 8, alignItems: "flex-end" },
  totRow: { flexDirection: "row", width: 220, justifyContent: "space-between", paddingVertical: 2 },
  totBig: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#c94c0e" },
  section: { marginTop: 14 },
  h: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  p: { fontSize: 9, lineHeight: 1.4, color: "#334155" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", fontSize: 8, color: "#94a3b8" },
});

function clean(t: string) {
  // Helvetica cannot render emoji; strip non-latin symbols
  return t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️]/gu, "").replace(/ {2,}/g, " ").trim();
}

export function InvoicePdf({ inv, logoSrc }: { inv: PublicInvoice; logoSrc?: string }) {
  const t = inv.tenant;
  const sur = t.surcharges.filter((x) => x.pct > 0);
  const pct = t.surcharges.find((x) => x.method === inv.surchargeMethod)?.pct;
  return (
    <Document title={`Cuenta de cobro ${inv.number}`} author={t.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.tenant}>{clean(t.name.toUpperCase())}</Text>
            {t.slogan ? <Text style={s.small}>{clean(t.slogan)}</Text> : null}
            {t.address ? <Text style={s.small}>{clean(t.address)}</Text> : null}
            {t.phone ? <Text style={s.small}>Teléfono: {t.phone}</Text> : null}
          </View>
          {logoSrc ? <Image src={logoSrc} style={s.logo} /> : null}
        </View>
        <View style={s.band}>
          <Text style={s.bandTitle}>CUENTA DE COBRO {inv.number}</Text>
          <Text style={{ fontSize: 9 }}>{ORDER_STATUS_LABEL[inv.status].toUpperCase()} · {formatDateTime(inv.createdAt)}</Text>
        </View>
        <View style={s.grid}>
          <View style={s.box}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.val}>{clean(inv.customer.name)}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.label}>Vehículo</Text>
            <Text style={s.val}>{[inv.vehicle.brand, inv.vehicle.model].join(" ")}</Text>
            <Text style={s.small}>{[inv.vehicle.plate, inv.km ? `${inv.km.toLocaleString("es-CO")} km` : ""].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>
        <View style={s.tr}>
          <Text style={[s.th, s.cDesc]}>Descripción</Text>
          <Text style={[s.th, s.cQty]}>Cant.</Text>
          <Text style={[s.th, s.cPrice]}>Unitario</Text>
          <Text style={[s.th, s.cTotal]}>Valor (COP)</Text>
        </View>
        {inv.items.map((it, i) => (
          <View key={i} style={s.tr}>
            <Text style={s.cDesc}>{clean(it.description)}</Text>
            <Text style={s.cQty}>{it.qty}</Text>
            <Text style={s.cPrice}>{formatMoney(it.unitPrice)}</Text>
            <Text style={s.cTotal}>{formatMoney(it.total)}</Text>
          </View>
        ))}
        <View style={s.totals}>
          <View style={s.totRow}><Text>Subtotal</Text><Text>{formatMoney(inv.subtotal)}</Text></View>
          {inv.discount > 0 ? <View style={s.totRow}><Text>Descuento</Text><Text>-{formatMoney(inv.discount)}</Text></View> : null}
          {inv.surcharge > 0 ? (
            <View style={s.totRow}>
              <Text>Recargo {inv.surchargeMethod ? PAYMENT_METHOD_LABEL[inv.surchargeMethod] : ""}{pct ? ` (${pct}%)` : ""}</Text>
              <Text>{formatMoney(inv.surcharge)}</Text>
            </View>
          ) : null}
          <View style={[s.totRow, { borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 4, paddingTop: 4 }]}>
            <Text style={s.totBig}>TOTAL</Text><Text style={s.totBig}>$ {formatMoney(inv.total)}</Text>
          </View>
        </View>
        <View style={s.section}>
          <Text style={s.h}>Métodos de pago</Text>
          <Text style={s.p}>- Efectivo</Text>
          {t.paymentInfo ? (
            <Text style={s.p}>
              - Transferencia: {clean(t.paymentInfo)}
              {sur.length ? ` (Los pagos por ${sur.map((x) => PAYMENT_METHOD_LABEL[x.method]).join("/")} tienen un cargo adicional del ${sur.map((x) => `${x.pct}%`).join("/")})` : ""}
            </Text>
          ) : null}
        </View>
        {t.warrantyText ? (
          <View style={s.section}>
            <Text style={s.h}>Política de garantía</Text>
            {t.warrantyText.split("\n").filter((l) => l.trim()).map((l, i) => (
              <Text key={i} style={s.p}>- {clean(l)}</Text>
            ))}
            {inv.warrantyUntil ? <Text style={[s.p, { marginTop: 3, fontFamily: "Helvetica-Bold" }]}>Garantía vigente hasta: {formatDate(inv.warrantyUntil)}</Text> : null}
          </View>
        ) : null}
        {t.footerText ? <Text style={[s.p, { marginTop: 14 }]}>{clean(t.footerText)}</Text> : null}
        <Text style={s.footer}>{clean(t.name)} · Generado con Motatto · motattomotocicletas.com</Text>
      </Page>
    </Document>
  );
}
