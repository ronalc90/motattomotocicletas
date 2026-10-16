import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, ClipboardPlus, Mic, Search, ShieldCheck, TrendingDown } from "lucide-react";
import { formatMoney, type DashboardData } from "@motatto/shared";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/hooks/useCan";
import { Card, CardTitle, EmptyState, PageLoader, Stat, StatusBadge, StockBadge } from "@/components/ui";
import { ago, fmtDate } from "@/lib/utils";
import { useState } from "react";

export function Dashboard() {
  const { user, tenant } = useAuth();
  const can = useCan();
  const nav = useNavigate();
  const [plate, setPlate] = useState("");
  const q = useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<DashboardData>("/dashboard"), refetchInterval: 60_000 });
  const d = q.data;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const showMoney = can("cash:read");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{greet}, {user?.name.split(" ")[0]}</h1>
        <p className="text-sm muted">{tenant?.name} · {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {can("orders:write") && <Quick to="/app/ordenes/nueva" icon={<ClipboardPlus className="h-5 w-5" />} label="Nueva orden" primary />}
        {can("assistant:use") && <Quick to="/app/asistente" icon={<Mic className="h-5 w-5" />} label="Hablar" />}
        {can("inventory:entry") && <Quick to="/app/inventario/entrada" icon={<Camera className="h-5 w-5" />} label="Entrada por foto" />}
        <form className="col-span-2 lg:col-span-1 relative" onSubmit={(e) => { e.preventDefault(); if (plate.trim()) nav(`/app/clientes?placa=${encodeURIComponent(plate.trim())}`); }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted" />
          <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="Buscar placa" className="field pl-9 uppercase font-display tracking-wider h-full" />
        </form>
      </div>

      {q.isLoading || !d ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {showMoney ? (
              <>
                <Stat label="Ventas de hoy" value={`$ ${formatMoney(d.today.sales)}`} sub={`${d.today.ordersPaid} cobradas`} tone="motor" />
                <Stat label="Gastos de hoy" value={`$ ${formatMoney(d.today.expenses)}`} />
                <Stat label="Ventas del mes" value={`$ ${formatMoney(d.month.sales)}`} sub={`${d.month.orders} órdenes`} tone="dark" />
              </>
            ) : (
              <Stat label="Órdenes cobradas hoy" value={d.today.ordersPaid} tone="motor" />
            )}
            <Stat label="Órdenes abiertas" value={d.openOrders.length} sub={`${d.lowStock.length} productos con stock bajo`} />
          </div>

          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
            <Card>
              <CardTitle action={<Link to="/app/ordenes" className="text-sm font-medium text-motor-dark">Ver todas</Link>}>Órdenes abiertas</CardTitle>
              {d.openOrders.length === 0 ? (
                <EmptyState title="Sin órdenes abiertas" text="Cuando llegue un vehículo, crea una orden." action={can("orders:write") && <Link to="/app/ordenes/nueva" className="text-motor-dark font-semibold text-sm">Nueva orden</Link>} />
              ) : (
                <ul className="divide-y line -mx-4 sm:-mx-5">
                  {d.openOrders.map((o) => (
                    <li key={o.id}>
                      <Link to={`/app/ordenes/${o.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2"><span className="font-semibold text-sm">{o.number}</span><StatusBadge status={o.status} /></div>
                          <div className="text-sm muted truncate">{o.customer?.name} · {o.vehicle?.brand} {o.vehicle?.model} {o.vehicle?.plate}</div>
                        </div>
                        <div className="text-right"><div className="font-semibold tabular-nums">{formatMoney(o.total)}</div><div className="text-xs muted">{ago(o.createdAt)}</div></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="space-y-4">
              <Card>
                <CardTitle action={<Link to="/app/inventario?low=1" className="text-sm font-medium text-motor-dark">Ver</Link>}><span className="inline-flex items-center gap-2"><TrendingDown className="h-4 w-4 text-bad" /> Stock bajo</span></CardTitle>
                {d.lowStock.length === 0 ? <p className="text-sm muted">Todo el inventario está por encima del mínimo.</p> : (
                  <ul className="space-y-2">
                    {d.lowStock.slice(0, 6).map((p) => (
                      <li key={p.id}><Link to={`/app/inventario/${p.id}`} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{p.name}</span><StockBadge stock={p.stock} minStock={p.minStock} /></Link></li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardTitle><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-ok" /> Garantías vigentes</span></CardTitle>
                {d.activeWarranties.length === 0 ? <p className="text-sm muted">Ninguna garantía activa.</p> : (
                  <ul className="space-y-2">
                    {d.activeWarranties.slice(0, 6).map((o) => (
                      <li key={o.id}><Link to={`/app/ordenes/${o.id}`} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{o.vehicle?.plate ?? o.vehicle?.model} · {o.customer?.name}</span><span className="text-xs muted whitespace-nowrap">hasta {fmtDate(o.warrantyUntil)}</span></Link></li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Quick({ to, icon, label, primary }: { to: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-2.5 rounded-card px-4 min-h-[56px] font-semibold text-sm ${primary ? "bg-motor text-white" : "card"}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${primary ? "bg-white/20" : "bg-motor-soft text-motor-dark dark:bg-motor/20 dark:text-orange-300"}`}>{icon}</span>{label}
    </Link>
  );
}
