import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { ORDER_STATUS, ORDER_STATUS_LABEL, formatMoney, type OrderStatus } from "@motatto/shared";
import { fetchers, qk } from "@/lib/queries";
import { useDebounce } from "@/hooks/useDebounce";
import { useCan } from "@/hooks/useCan";
import { Button, EmptyState, PageHeader, PageLoader, SearchBox, StatusBadge, Tabs } from "@/components/ui";
import { ago } from "@/lib/utils";

type Tab = "todas" | OrderStatus;

export function Orders() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("estado") as Tab) || "todas";
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounce(q, 300);
  const can = useCan();
  const nav = useNavigate();
  const params = { status: tab === "todas" ? undefined : tab, q: dq || undefined, limit: 100 };
  const list = useQuery({ queryKey: qk.orders(params), queryFn: () => fetchers.orders(params) });

  return (
    <div>
      <PageHeader title="Órdenes" sub={list.data ? `${list.data.total} en total` : undefined}
        action={can("orders:write") && <Link to="/app/ordenes/nueva" className="hidden sm:block"><Button icon={<Plus className="h-4 w-4" />}>Nueva orden</Button></Link>} />
      <SearchBox value={q} onChange={setQ} placeholder="Número, cliente, placa…" className="mb-3" />
      <Tabs value={tab} onChange={(v) => setSp((s) => { s.set("estado", v); return s; })} items={[{ value: "todas", label: "Todas" }, ...ORDER_STATUS.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))]} className="mb-4" />
      {list.isLoading ? <PageLoader /> : !list.data?.items.length ? (
        <EmptyState icon={<ClipboardList />} title="No hay órdenes aquí" text={dq ? "Prueba con otra búsqueda." : "Crea la primera cuando llegue un vehículo."} action={can("orders:write") && <Link to="/app/ordenes/nueva"><Button>Nueva orden</Button></Link>} />
      ) : (
        <ul className="space-y-2">
          {list.data.items.map((o) => (
            <li key={o.id} onClick={() => nav(`/app/ordenes/${o.id}`)} className="card p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
              {o.vehicle?.plate ? <span className="plate px-1.5 py-0.5 text-xs w-[76px] justify-center">{o.vehicle.plate}</span> : <span className="w-[76px] text-xs muted text-center">sin placa</span>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-sm">{o.number}</span><StatusBadge status={o.status} />{o.warrantyOfOrderId && <span className="text-xs text-ok font-medium">garantía</span>}</div>
                <div className="text-sm truncate">{o.customer?.name}</div>
                <div className="text-xs muted truncate">{o.vehicle?.brand} {o.vehicle?.model} · {o.items.length} líneas · {ago(o.createdAt)}</div>
              </div>
              <div className="font-display font-bold tabular-nums text-right">{formatMoney(o.total)}</div>
            </li>
          ))}
        </ul>
      )}
      {can("orders:write") && (
        <Link to="/app/ordenes/nueva" aria-label="Nueva orden" className="sm:hidden fixed right-4 bottom-20 z-20 h-14 w-14 rounded-full bg-motor text-white shadow-float flex items-center justify-center"><Plus className="h-6 w-6" /></Link>
      )}
    </div>
  );
}
