import type { PublicInvoice } from "@motatto/shared";
import { PAYMENT_METHOD_LABEL, formatDate, formatDateTime, formatMoney } from "@motatto/shared";
import { StatusBadge } from "@/components/ui";
import { assetUrl } from "@/lib/api";

/** Printable HTML invoice shared by the public page and the order detail. */
export function InvoiceView({ inv }: { inv: PublicInvoice }) {
  const t = inv.tenant;
  const pct = t.surcharges.find((x) => x.method === inv.surchargeMethod)?.pct;
  const sur = t.surcharges.filter((x) => x.pct > 0);
  const logo = assetUrl(t.logoUrl);
  return (
    <article className="card overflow-hidden print:shadow-none">
      <header className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">{t.name}</h1>
          {t.slogan && <p className="text-sm muted">{t.slogan}</p>}
          <p className="text-sm muted mt-1">{[t.address, t.phone && `Tel. ${t.phone}`].filter(Boolean).join(" · ")}</p>
        </div>
        {logo && <img src={logo} alt="" className="h-16 w-16 rounded-xl object-contain bg-white border line shrink-0" />}
      </header>
      <div className="bg-ink text-white px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide opacity-70">Cuenta de cobro</div>
          <div className="font-display text-lg font-bold">{inv.number}</div>
        </div>
        <div className="text-right text-sm">
          <StatusBadge status={inv.status} className="mb-1" />
          <div className="opacity-80">{formatDateTime(inv.createdAt)}</div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 p-5 sm:p-6 pb-2">
        <div className="rounded-xl border line p-3">
          <div className="text-xs muted">Cliente</div>
          <div className="font-semibold">{inv.customer.name}</div>
        </div>
        <div className="rounded-xl border line p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs muted">Vehículo</div>
            <div className="font-semibold">{inv.vehicle.brand} {inv.vehicle.model}</div>
            {inv.km ? <div className="text-xs muted">{inv.km.toLocaleString("es-CO")} km</div> : null}
          </div>
          {inv.vehicle.plate && <span className="plate px-2 py-0.5 text-sm">{inv.vehicle.plate}</span>}
        </div>
      </div>
      <div className="px-5 sm:px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b line text-xs muted">
              <th className="py-2 text-left font-medium">Descripción</th>
              <th className="py-2 text-right font-medium w-12">Cant.</th>
              <th className="py-2 text-right font-medium hidden sm:table-cell">Unitario</th>
              <th className="py-2 text-right font-medium">Valor (COP)</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b line last:border-0">
                <td className="py-2.5 pr-2">{it.description}</td>
                <td className="py-2.5 text-right tabular-nums">{it.qty}</td>
                <td className="py-2.5 text-right tabular-nums hidden sm:table-cell">{formatMoney(it.unitPrice)}</td>
                <td className="py-2.5 text-right tabular-nums font-medium">{formatMoney(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto max-w-xs mt-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="muted">Subtotal</span><span className="tabular-nums">{formatMoney(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between"><span className="muted">Descuento</span><span className="tabular-nums">-{formatMoney(inv.discount)}</span></div>}
          {inv.surcharge > 0 && (
            <div className="flex justify-between"><span className="muted">Recargo {inv.surchargeMethod ? PAYMENT_METHOD_LABEL[inv.surchargeMethod] : ""}{pct ? ` (${pct}%)` : ""}</span><span className="tabular-nums">{formatMoney(inv.surcharge)}</span></div>
          )}
          <div className="flex justify-between border-t line pt-2 mt-2 font-display text-xl font-bold"><span>Total</span><span className="tabular-nums text-motor-dark">$ {formatMoney(inv.total)}</span></div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-5 p-5 sm:p-6 text-sm">
        <div>
          <h3 className="font-semibold mb-1">Métodos de pago</h3>
          <ul className="space-y-1 muted">
            <li>Efectivo</li>
            {t.paymentInfo && <li>Transferencia: <span className="font-medium text-current">{t.paymentInfo}</span></li>}
            {sur.length > 0 && <li className="text-amber-800 dark:text-amber-200">Los pagos por {sur.map((x) => PAYMENT_METHOD_LABEL[x.method]).join("/")} tienen un cargo adicional del {sur.map((x) => `${x.pct}%`).join("/")}.</li>}
          </ul>
        </div>
        {t.warrantyText && (
          <div>
            <h3 className="font-semibold mb-1">Política de garantía</h3>
            <p className="whitespace-pre-line muted leading-6">{t.warrantyText}</p>
            {inv.warrantyUntil && <p className="mt-2 font-medium text-ok">Garantía vigente hasta: {formatDate(inv.warrantyUntil)}</p>}
          </div>
        )}
      </div>
      {t.footerText && <p className="px-5 sm:px-6 pb-5 text-sm text-center muted">{t.footerText}</p>}
    </article>
  );
}
