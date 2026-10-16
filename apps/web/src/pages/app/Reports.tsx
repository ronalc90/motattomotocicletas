import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { endOfMonth, format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { PAYMENT_METHOD_LABEL, formatMoney, type ReportSales } from "@motatto/shared";
import { api, downloadBlob, errorMessage } from "@/lib/api";
import { qk } from "@/lib/queries";
import { Button, Card, CardTitle, EmptyState, PageHeader, PageLoader, Stat, Tabs } from "@/components/ui";
import { fmtDay, todayStr } from "@/lib/utils";

type Preset = "hoy" | "semana" | "mes" | "30" | "custom";
const D = (d: Date) => format(d, "yyyy-MM-dd");

export function Reports() {
  const [preset, setPreset] = useState<Preset>("mes");
  const [custom, setCustom] = useState({ from: D(startOfMonth(new Date())), to: todayStr() });
  const range = (() => {
    const now = new Date();
    switch (preset) {
      case "hoy": return { from: todayStr(), to: todayStr() };
      case "semana": return { from: D(startOfWeek(now, { weekStartsOn: 1 })), to: todayStr() };
      case "mes": return { from: D(startOfMonth(now)), to: D(endOfMonth(now)) };
      case "30": return { from: D(subDays(now, 29)), to: todayStr() };
      default: return custom;
    }
  })();
  const q = useQuery({ queryKey: qk.report(range.from, range.to), queryFn: () => api.get<ReportSales>("/reports/sales", range) });
  const exp = useMutation({ mutationFn: () => api.blob("/reports/sales/export", range), onSuccess: (b) => downloadBlob(b, `ventas-${range.from}-${range.to}.xlsx`), onError: (e) => toast.error(errorMessage(e)) });
  const r = q.data;
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader title="Reportes" sub={`${fmtDay(range.from)} – ${fmtDay(range.to)}`} action={<Button variant="outline" onClick={() => exp.mutate()} loading={exp.isPending} icon={<Download className="h-4 w-4" />}>Exportar Excel</Button>} />
      <Tabs value={preset} onChange={setPreset} items={[{ value: "hoy", label: "Hoy" }, { value: "semana", label: "Esta semana" }, { value: "mes", label: "Este mes" }, { value: "30", label: "Últimos 30 días" }, { value: "custom", label: "Personalizado" }]} />
      {preset === "custom" && <div className="flex gap-2 items-center"><input type="date" className="field w-auto" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /><span className="muted">a</span><input type="date" className="field w-auto" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></div>}
      {q.isLoading || !r ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Ventas" value={`$ ${formatMoney(r.totalSales)}`} tone="motor" />
            <Stat label="Costo de repuestos" value={`$ ${formatMoney(r.totalCost)}`} />
            <Stat label="Utilidad" value={`$ ${formatMoney(r.profit)}`} sub={r.totalSales ? `${Math.round((r.profit / r.totalSales) * 100)}% margen` : undefined} tone="dark" />
            <Stat label="Órdenes pagadas" value={r.ordersCount} sub={r.ordersCount ? `promedio ${formatMoney(Math.round(r.totalSales / r.ordersCount))}` : undefined} />
          </div>
          <Card>
            <CardTitle>Ventas por día</CardTitle>
            {r.byDay.length === 0 ? <EmptyState title="Sin ventas en este periodo" /> : <BarChart data={r.byDay.map((d) => ({ label: d.date.slice(5), value: d.sales, sub: `${d.orders} órd.` }))} />}
          </Card>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardTitle>Por método de pago</CardTitle>
              <ul className="space-y-2">
                {r.byMethod.map((m) => {
                  const pct = r.totalSales ? (m.amount / r.totalSales) * 100 : 0;
                  return (
                    <li key={m.method} className="text-sm"><div className="flex justify-between mb-1"><span>{PAYMENT_METHOD_LABEL[m.method]}</span><span className="tabular-nums font-medium">{formatMoney(m.amount)} <span className="muted">({Math.round(pct)}%)</span></span></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-motor" style={{ width: `${pct}%` }} /></div></li>
                  );
                })}
                {!r.byMethod.length && <li className="text-sm muted">Sin pagos.</li>}
              </ul>
            </Card>
            <TopTable title="Clientes frecuentes" rows={r.topCustomers.map((c) => ({ k: c.customerId, name: c.name, qty: c.orders, sales: c.sales }))} qtyLabel="Órdenes" />
            <TopTable title="Repuestos más vendidos" rows={r.topProducts.map((p) => ({ k: p.productId, name: p.name, qty: p.qty, sales: p.sales }))} qtyLabel="Cant." />
            <TopTable title="Servicios más hechos" rows={r.topServices.map((s, i) => ({ k: s.serviceId ?? String(i), name: s.name, qty: s.qty, sales: s.sales }))} qtyLabel="Cant." />
          </div>
        </>
      )}
    </div>
  );
}

function TopTable({ title, rows, qtyLabel }: { title: string; rows: Array<{ k: string; name: string; qty: number; sales: number }>; qtyLabel: string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {!rows.length ? <p className="text-sm muted">Sin datos.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-xs muted text-left"><th className="py-1 font-medium">Nombre</th><th className="py-1 font-medium text-right">{qtyLabel}</th><th className="py-1 font-medium text-right">Ventas</th></tr></thead>
          <tbody>{rows.slice(0, 10).map((x) => <tr key={x.k} className="border-t line"><td className="py-1.5 truncate max-w-[180px]">{x.name}</td><td className="py-1.5 text-right tabular-nums">{x.qty}</td><td className="py-1.5 text-right tabular-nums font-medium">{formatMoney(x.sales)}</td></tr>)}</tbody>
        </table>
      )}
    </Card>
  );
}

/** Minimal inline SVG bar chart. */
function BarChart({ data }: { data: Array<{ label: string; value: number; sub?: string }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = Math.max(320, data.length * 28);
  const H = 160;
  const pad = 20;
  const bw = (W - pad * 2) / data.length;
  const step = Math.max(1, Math.ceil(data.length / 10));
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ minWidth: W / 1.5 }} role="img" aria-label="Ventas por día">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={pad} x2={W - pad} y1={H - f * (H - 10)} y2={H - f * (H - 10)} stroke="currentColor" strokeOpacity={0.08} />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (H - 10);
          const x = pad + i * bw + bw * 0.15;
          return (
            <g key={i}>
              <title>{d.label}: {formatMoney(d.value)}{d.sub ? ` · ${d.sub}` : ""}</title>
              <rect x={x} y={H - h} width={bw * 0.7} height={h} rx={3} fill="#F0611A" opacity={0.9} />
              {i % step === 0 && <text x={x + bw * 0.35} y={H + 14} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>{d.label}</text>}
            </g>
          );
        })}
        <text x={pad} y={10} fontSize={10} fill="currentColor" opacity={0.6}>máx. {formatMoney(max)}</text>
      </svg>
    </div>
  );
}
