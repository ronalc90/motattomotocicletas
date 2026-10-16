import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, Car, ChevronLeft, ClipboardPlus, MessageCircle, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { formatMoney, whatsappLink, type Order, type Paginated, type Vehicle } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { fetchers, qk } from "@/lib/queries";
import { useDebounce } from "@/hooks/useDebounce";
import { useCan } from "@/hooks/useCan";
import { Avatar, Button, Card, CardTitle, ConfirmDialog, EmptyState, PageHeader, PageLoader, SearchBox, StatusBadge } from "@/components/ui";
import { CustomerModal, VehicleModal } from "@/components/customers/CustomerForms";
import { fmtDate } from "@/lib/utils";

export function Customers() {
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get("placa") ?? sp.get("q") ?? "");
  const dq = useDebounce(q, 250);
  const nav = useNavigate();
  const can = useCan();
  const [create, setCreate] = useState(false);
  const list = useQuery({ queryKey: qk.customers(dq), queryFn: () => fetchers.customers(dq) });
  const byPlate = useQuery({ queryKey: ["plate", dq], queryFn: () => api.get<Vehicle>(`/vehicles/plate/${encodeURIComponent(dq.replace(/\s+/g, ""))}`), enabled: /^[A-Za-z0-9-]{3,10}$/.test(dq.replace(/\s+/g, "")), retry: false });
  useEffect(() => { if (byPlate.data?.customer) nav(`/app/clientes/${byPlate.data.customer.id}`); }, [byPlate.data, nav]);

  return (
    <div>
      <PageHeader title="Clientes" sub={list.data ? `${list.data.total} clientes` : undefined} action={can("customers:write") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreate(true)}>Nuevo</Button>} />
      <SearchBox value={q} onChange={setQ} placeholder="Nombre, teléfono, documento o placa" className="mb-4" />
      {list.isLoading ? <PageLoader /> : !list.data?.items.length ? (
        <EmptyState icon={<Users />} title="Sin clientes" text={dq ? `Nada con “${dq}”.` : "Crea el primero cuando llegue un vehículo."} action={can("customers:write") && <Button onClick={() => setCreate(true)}>Nuevo cliente</Button>} />
      ) : (
        <ul className="space-y-2">
          {list.data.items.map((c) => (
            <li key={c.id}><Link to={`/app/clientes/${c.id}`} className="card p-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"><Avatar name={c.name} /><span className="flex-1 min-w-0"><span className="block font-medium truncate">{c.name}</span><span className="block text-sm muted">{[c.phone, c.document].filter(Boolean).join(" · ") || "sin teléfono"}</span></span></Link></li>
          ))}
        </ul>
      )}
      <CustomerModal open={create} onClose={() => setCreate(false)} onSaved={(c) => { setCreate(false); nav(`/app/clientes/${c.id}`); }} />
    </div>
  );
}

export function CustomerDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const c = useQuery({ queryKey: qk.customer(id), queryFn: () => fetchers.customer(id) });
  const orders = useQuery({ queryKey: ["customer-orders", id], queryFn: () => api.get<Paginated<Order>>(`/customers/${id}/orders`) });
  const [edit, setEdit] = useState(false);
  const [addVehicle, setAddVehicle] = useState(false);
  const [del, setDel] = useState(false);
  const remove = useMutation({ mutationFn: () => api.delete(`/customers/${id}`), onSuccess: () => { toast.success("Cliente eliminado"); nav("/app/clientes"); }, onError: (e) => toast.error(errorMessage(e)) });
  if (c.isLoading) return <PageLoader />;
  const cust = c.data;
  if (!cust) return <EmptyState title="Cliente no encontrado" />;
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader title={cust.name} back={<Link to="/app/clientes" className="inline-flex items-center gap-1 text-sm muted mb-1"><ChevronLeft className="h-4 w-4" /> Clientes</Link>}
        sub={[cust.phone, cust.document].filter(Boolean).join(" · ")}
        action={<>
          {cust.phone && <a href={whatsappLink(cust.phone, `Hola ${cust.name.split(" ")[0]},`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-btn bg-ok text-white h-11 px-4 font-semibold text-[15px]"><MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">WhatsApp</span></a>}
          {can("customers:write") && <Button variant="outline" size="icon" onClick={() => setEdit(true)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>}
          {can("customers:write") && <Button variant="ghost" size="icon" className="text-bad" onClick={() => setDel(true)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>}
        </>} />
      {cust.notes && <p className="text-sm muted whitespace-pre-line">{cust.notes}</p>}
      <Card>
        <CardTitle action={can("customers:write") && <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setAddVehicle(true)}>Vehículo</Button>}>Vehículos</CardTitle>
        {!cust.vehicles?.length ? <p className="text-sm muted">Sin vehículos.</p> : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {cust.vehicles.map((v) => (
              <li key={v.id}>
                <Link to={`/app/vehiculos/${v.id}`} className="flex items-center gap-3 rounded-xl border line p-3 hover:border-motor">
                  {v.kind === "carro" ? <Car className="h-5 w-5 muted" /> : <Bike className="h-5 w-5 muted" />}
                  <span className="flex-1 min-w-0"><span className="block font-medium">{v.brand} {v.model}</span><span className="block text-xs muted">{[v.year, v.color, v.lastKm && `${v.lastKm.toLocaleString("es-CO")} km`].filter(Boolean).join(" · ")}</span></span>
                  {v.plate && <span className="plate px-1.5 text-xs">{v.plate}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle action={can("orders:write") && <Button size="sm" icon={<ClipboardPlus className="h-4 w-4" />} onClick={() => nav("/app/ordenes/nueva", { state: { customerId: cust.id, vehicleId: cust.vehicles?.length === 1 ? cust.vehicles[0].id : undefined } })}>Nueva orden</Button>}>Historial</CardTitle>
        <OrderList orders={orders.data?.items ?? []} loading={orders.isLoading} />
      </Card>
      <CustomerModal open={edit} initial={cust} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); qc.invalidateQueries({ queryKey: qk.customer(id) }); }} />
      <VehicleModal open={addVehicle} customerId={id} onClose={() => setAddVehicle(false)} onSaved={() => { setAddVehicle(false); qc.invalidateQueries({ queryKey: qk.customer(id) }); }} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title="¿Eliminar cliente?" message="Solo se puede eliminar si no tiene órdenes. Se borran también sus vehículos." confirmText="Eliminar" />
    </div>
  );
}

export function OrderList({ orders, loading }: { orders: Order[]; loading?: boolean }) {
  if (loading) return <PageLoader />;
  if (!orders.length) return <p className="text-sm muted">Sin órdenes todavía.</p>;
  return (
    <ul className="divide-y line -mx-4 sm:-mx-5">
      {orders.map((o) => (
        <li key={o.id}><Link to={`/app/ordenes/${o.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <span className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="text-sm font-semibold">{o.number}</span><StatusBadge status={o.status} /></span><span className="block text-xs muted truncate">{fmtDate(o.createdAt)} · {o.items.map((i) => i.description).join(", ")}</span></span>
          <span className="font-semibold tabular-nums text-sm">{formatMoney(o.total)}</span>
        </Link></li>
      ))}
    </ul>
  );
}

export function VehicleDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const can = useCan();
  const v = useQuery({ queryKey: qk.vehicle(id), queryFn: () => fetchers.vehicle(id) });
  const orders = useQuery({ queryKey: ["vehicle-orders", id], queryFn: () => api.get<Paginated<Order>>(`/vehicles/${id}/orders`) });
  const [edit, setEdit] = useState(false);
  if (v.isLoading) return <PageLoader />;
  const veh = v.data;
  if (!veh) return <EmptyState title="Vehículo no encontrado" />;
  const warranty = (orders.data?.items ?? []).find((o) => o.status === "pagada" && o.warrantyUntil && new Date(o.warrantyUntil) >= new Date());
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader title={<span className="inline-flex items-center gap-3 flex-wrap">{veh.brand} {veh.model}{veh.plate && <span className="plate px-2.5 py-0.5 text-base">{veh.plate}</span>}</span>}
        back={<Link to={`/app/clientes/${veh.customerId}`} className="inline-flex items-center gap-1 text-sm muted mb-1"><ChevronLeft className="h-4 w-4" /> {veh.customer?.name ?? "Cliente"}</Link>}
        sub={[veh.kind === "carro" ? "Carro" : "Moto", veh.year, veh.color, veh.lastKm && `${veh.lastKm.toLocaleString("es-CO")} km`].filter(Boolean).join(" · ")}
        action={<>{can("customers:write") && <Button variant="outline" size="icon" onClick={() => setEdit(true)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>}{can("orders:write") && <Button icon={<ClipboardPlus className="h-4 w-4" />} onClick={() => nav("/app/ordenes/nueva", { state: { customerId: veh.customerId, vehicleId: veh.id } })}>Nueva orden</Button>}</>} />
      {warranty ? (
        <div className="rounded-card bg-ok-soft text-ok p-4 text-sm flex items-center gap-3"><ShieldCheck className="h-5 w-5 shrink-0" /><span className="flex-1">Garantía vigente hasta <strong>{fmtDate(warranty.warrantyUntil)}</strong> por la orden {warranty.number}.</span>{can("orders:write") && <Button size="sm" variant="dark" onClick={() => nav("/app/ordenes/nueva", { state: { customerId: veh.customerId, vehicleId: veh.id, warrantyOfOrderId: warranty.id } })}>Orden de garantía</Button>}</div>
      ) : <div className="text-sm muted">Sin garantía vigente.</div>}
      <Card><CardTitle>Historial</CardTitle><OrderList orders={orders.data?.items ?? []} loading={orders.isLoading} /></Card>
      <VehicleModal open={edit} initial={veh} customerId={veh.customerId} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); qc.invalidateQueries({ queryKey: qk.vehicle(id) }); }} />
    </div>
  );
}
