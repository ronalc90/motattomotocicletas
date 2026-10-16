import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ChevronLeft, Mic, Package, Plus, Search, Trash2, UserPlus, Wrench, X } from "lucide-react";
import { computeTotals, formatMoney, type Customer, type ItemType, type Order, type OrderStatus, type Product, type Service, type Vehicle } from "@motatto/shared";
import { api, assetUrl, errorMessage } from "@/lib/api";
import { fetchers, qk } from "@/lib/queries";
import { useDebounce } from "@/hooks/useDebounce";
import { useCan } from "@/hooks/useCan";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Input, Modal, MoneyInput, PageHeader, PhotoInput, Row, Spinner, StockBadge, Textarea } from "@/components/ui";
import { CustomerModal, VehicleModal } from "@/components/customers/CustomerForms";
import { AssistantPanel, type ProposedItem } from "@/components/assistant/AssistantPanel";
import { DeductModal, type Deduct } from "@/components/orders/DeductModal";
import type { DeductRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface Line { key: string; type: ItemType; productId?: string; serviceId?: string; description: string; qty: number; unitPrice: number; stock?: number }
let seq = 0;
const nk = () => `l${++seq}`;

interface NavState { items?: ProposedItem[]; customer?: { id?: string; name: string }; vehicle?: { id?: string; brand?: string; model?: string; plate?: string }; transcript?: string; customerId?: string; vehicleId?: string; warrantyOfOrderId?: string }

export function OrderForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const { tenant } = useAuth();
  const state = (useLocation().state ?? {}) as NavState;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [lines, setLines] = useState<Line[]>(() => (state.items ?? []).map((i) => ({ key: nk(), type: i.type, productId: i.productId, serviceId: i.serviceId, description: i.description, qty: i.qty, unitPrice: i.unitPrice })));
  const [discount, setDiscount] = useState(0);
  const [km, setKm] = useState<string>("");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [picker, setPicker] = useState<"repuesto" | "servicio" | "otro" | null>(null);
  const [assistant, setAssistant] = useState(false);
  const [deduct, setDeduct] = useState<{ rows: DeductRow[]; order: Order } | null>(null);
  const source = state.items ? "voz" : "manual";

  // editing: load order
  const existing = useQuery({ queryKey: qk.order(id ?? ""), queryFn: () => fetchers.order(id!), enabled: editing });
  useEffect(() => {
    const o = existing.data;
    if (!o) return;
    setLines(o.items.map((i) => ({ key: nk(), type: i.type, productId: i.productId, serviceId: i.serviceId, description: i.description, qty: i.qty, unitPrice: i.unitPrice })));
    setDiscount(o.discount);
    setKm(o.km ? String(o.km) : "");
    setDescription(o.description ?? "");
    setInternalNotes(o.internalNotes ?? "");
    setPhotos(o.photos);
    fetchers.customer(o.customerId).then(setCustomer).catch(() => undefined);
    fetchers.vehicle(o.vehicleId).then(setVehicle).catch(() => undefined);
    setStep(2);
  }, [existing.data]);

  // prefill from state (assistant / customer page / warranty)
  useEffect(() => {
    const cid = state.customerId ?? state.customer?.id;
    const vid = state.vehicleId ?? state.vehicle?.id;
    if (cid) fetchers.customer(cid).then(setCustomer).catch(() => undefined);
    if (vid) fetchers.vehicle(vid).then(setVehicle).catch(() => undefined);
    if (cid && vid) setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = computeTotals(lines, discount, 0);
  const canPrice = can("orders:price");

  const save = useMutation({
    mutationFn: async (status: OrderStatus) => {
      if (!customer || !vehicle) throw new Error("Selecciona cliente y vehículo");
      if (!lines.length) throw new Error("Agrega al menos una línea");
      const body = {
        customerId: customer.id, vehicleId: vehicle.id, km: km ? Number(km) : undefined, description, internalNotes, discount, photos,
        items: lines.map((l, i) => ({ type: l.type, productId: l.productId, serviceId: l.serviceId, description: l.description, qty: l.qty, unitPrice: l.unitPrice, pos: i })),
        source, voiceTranscript: state.transcript, warrantyOfOrderId: state.warrantyOfOrderId,
      };
      let order: Order;
      if (editing) {
        const { source: _s, voiceTranscript: _v, warrantyOfOrderId: _w, ...patch } = body;
        order = await api.patch<Order>(`/orders/${id}`, patch);
      } else order = await api.post<Order>("/orders", body);
      if (status !== "recibida" && order.status !== status) {
        if (status === "terminada" && (tenant?.settings.askStockOnClose ?? true)) {
          const rows = await api.get<DeductRow[]>(`/orders/${order.id}/deduct-preview`);
          if (rows.length) { setDeduct({ rows, order }); return order; }
        }
        order = await api.post<Order>(`/orders/${order.id}/status`, { status });
      }
      return order;
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      if (!deduct) { toast.success(editing ? "Orden actualizada" : `Orden ${order.number} creada`); nav(`/app/ordenes/${order.id}`, { replace: true }); }
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const finish = useMutation({
    mutationFn: async (d: Deduct) => api.post<Order>(`/orders/${deduct!.order.id}/status`, { status: "terminada", deduct: d }),
    onSuccess: (o) => { toast.success(`Orden ${o.number} terminada`); setDeduct(null); nav(`/app/ordenes/${o.id}`, { replace: true }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function uploadPhotos(files: File[]) {
    setUploading(true);
    try {
      for (const f of files) {
        const r = await api.upload<{ url: string }>("/uploads", f, "file", { folder: "orders" });
        setPhotos((p) => [...p, r.url]);
      }
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); }
  }

  function addLine(l: Omit<Line, "key">) { setLines((a) => [...a, { ...l, key: nk() }]); setPicker(null); }
  function upd(key: string, patch: Partial<Line>) { setLines((a) => a.map((l) => (l.key === key ? { ...l, ...patch } : l))); }

  if (editing && existing.isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={editing ? `Editar ${existing.data?.number ?? ""}` : "Nueva orden"} back={<button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm muted mb-1"><ChevronLeft className="h-4 w-4" /> Volver</button>}
        sub={<span className="inline-flex gap-2"><StepDot n={1} active={step === 1} done={!!customer && !!vehicle} label="Cliente y vehículo" onClick={() => setStep(1)} /><StepDot n={2} active={step === 2} done={lines.length > 0} label="Trabajo" onClick={() => customer && vehicle && setStep(2)} /></span>} />

      {step === 1 ? (
        <CustomerVehicleStep customer={customer} vehicle={vehicle} onCustomer={(c) => { setCustomer(c); setVehicle(null); }} onVehicle={setVehicle} onNext={() => setStep(2)} initialQuery={state.vehicle?.plate ?? state.customer?.name ?? ""} />
      ) : (
        <div className="space-y-4">
          <div className="card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 text-sm"><span className="font-semibold">{customer?.name}</span><span className="muted"> · {vehicle?.brand} {vehicle?.model}</span></div>
            {vehicle?.plate && <span className="plate px-2 py-0.5 text-xs">{vehicle.plate}</span>}
            {!editing && <button className="text-sm text-motor-dark font-medium" onClick={() => setStep(1)}>Cambiar</button>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <AddBtn icon={<Package className="h-5 w-5" />} label="Repuesto" onClick={() => setPicker("repuesto")} />
            <AddBtn icon={<Wrench className="h-5 w-5" />} label="Servicio" onClick={() => setPicker("servicio")} />
            <AddBtn icon={<Plus className="h-5 w-5" />} label="Otro" onClick={() => setPicker("otro")} />
          </div>
          {can("assistant:use") && (
            <button onClick={() => setAssistant(true)} className="w-full rounded-card bg-ink text-white p-3 flex items-center gap-3 text-left">
              <span className="h-10 w-10 rounded-full bg-motor flex items-center justify-center"><Mic className="h-5 w-5" /></span>
              <span><span className="block font-semibold text-sm">Dictar las líneas</span><span className="block text-xs text-slate-300">“Kit de arrastre, cambio de kit, purga de frenos…”</span></span>
            </button>
          )}

          <div className="card p-0 overflow-hidden">
            {lines.length === 0 ? <p className="p-6 text-center text-sm muted">Sin líneas todavía. Agrega repuestos, servicios u otros.</p> : (
              <ul className="divide-y line">
                {lines.map((l) => (
                  <li key={l.key} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge tone={l.type === "repuesto" ? "blue" : l.type === "servicio" ? "violet" : "neutral"} className="mt-2.5 shrink-0">{l.type === "repuesto" ? "R" : l.type === "servicio" ? "S" : "O"}</Badge>
                      <input className="field flex-1" value={l.description} onChange={(e) => upd(l.key, { description: e.target.value })} />
                      <button className="tap flex items-center justify-center text-bad rounded-btn hover:bg-bad-soft" onClick={() => setLines((a) => a.filter((x) => x.key !== l.key))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center gap-2 pl-8">
                      <div className="flex items-center rounded-btn border line overflow-hidden h-10">
                        <button className="w-10 h-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => upd(l.key, { qty: Math.max(1, l.qty - 1) })}>−</button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                        <button className="w-10 h-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => upd(l.key, { qty: l.qty + 1 })}>+</button>
                      </div>
                      {l.stock !== undefined && <span className={cn("text-xs", l.stock < l.qty ? "text-bad" : "muted")}>stock {l.stock}</span>}
                      <div className="ml-auto w-36"><MoneyInput value={l.unitPrice} onChange={(n) => upd(l.key, { unitPrice: n })} disabled={!canPrice} className="h-10 py-1" /></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Kilometraje" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} placeholder="48500" />
              {can("orders:discount") ? <MoneyInput label="Descuento" value={discount} onChange={setDiscount} /> : <div />}
            </div>
            <Textarea label="¿Qué le pasa? / descripción" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <Textarea label="Notas internas (no salen en la cuenta)" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
            <div>
              <span className="mb-1.5 block text-sm font-medium">Fotos de entrada</span>
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <span key={p} className="relative"><img src={assetUrl(p)} alt="" className="h-20 w-20 rounded-xl object-cover border line" /><button onClick={() => setPhotos((a) => a.filter((x) => x !== p))} className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-bad text-white flex items-center justify-center" aria-label="Quitar foto"><X className="h-3 w-3" /></button></span>
                ))}
                <PhotoInput variant="outline" multiple loading={uploading} onFiles={uploadPhotos} className="h-20 w-20 flex-col gap-1 text-xs"><Camera className="h-5 w-5" /></PhotoInput>
              </div>
            </div>
          </div>

          <div className="card">
            <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
            {totals.discount > 0 && <Row label="Descuento" value={`-${formatMoney(totals.discount)}`} />}
            <Row label="Total" value={`$ ${formatMoney(totals.total)}`} strong />
            <p className="text-xs muted mt-1">El recargo por Nequi/transferencia se calcula al cobrar.</p>
          </div>

          <div className="sticky bottom-20 lg:bottom-4 z-10 card p-3 grid grid-cols-3 gap-2 shadow-float">
            <Button variant="secondary" onClick={() => save.mutate("recibida")} loading={save.isPending}>{editing ? "Guardar" : "Recibida"}</Button>
            <Button variant="outline" onClick={() => save.mutate("cotizada")} disabled={save.isPending}>Cotizada</Button>
            <Button onClick={() => save.mutate("terminada")} disabled={save.isPending || !can("orders:finish")}>Terminada</Button>
          </div>
        </div>
      )}

      {picker === "repuesto" && <ProductPicker onPick={(p) => addLine({ type: "repuesto", productId: p.id, description: p.name, qty: 1, unitPrice: p.price, stock: p.stock })} onClose={() => setPicker(null)} />}
      {picker === "servicio" && <ServicePicker onPick={(s) => addLine({ type: "servicio", serviceId: s.id, description: s.name, qty: 1, unitPrice: s.suggestedPrice })} onClose={() => setPicker(null)} />}
      {picker === "otro" && <OtherPicker onPick={(d, p) => addLine({ type: "otro", description: d, qty: 1, unitPrice: p })} onClose={() => setPicker(null)} />}

      <Modal open={assistant} onClose={() => setAssistant(false)} title="Dictar líneas" drawer>
        <div className="h-[70dvh] sm:h-[calc(100dvh-5rem)]">
          <AssistantPanel compact context={{ customerId: customer?.id, vehicleId: vehicle?.id }} useLabel="Agregar estas líneas a la orden"
            onUseItems={(items) => { setLines((a) => [...a, ...items.map((i) => ({ key: nk(), type: i.type, productId: i.productId, serviceId: i.serviceId, description: i.description, qty: i.qty, unitPrice: i.unitPrice }))]); setAssistant(false); toast.success(`${items.length} líneas agregadas`); }} />
        </div>
      </Modal>

      <DeductModal open={!!deduct} rows={deduct?.rows ?? []} onClose={() => { if (deduct) nav(`/app/ordenes/${deduct.order.id}`, { replace: true }); }} onConfirm={(d) => finish.mutate(d)} loading={finish.isPending} />
    </div>
  );
}

function StepDot({ n, active, done, label, onClick }: { n: number; active: boolean; done: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 text-xs font-medium", active ? "text-motor-dark" : done ? "text-ok" : "muted")}>
      <span className={cn("h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center", active ? "bg-motor text-white" : done ? "bg-ok text-white" : "bg-slate-200 dark:bg-slate-700")}>{n}</span>{label}
    </button>
  );
}
function AddBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="card min-h-[64px] flex flex-col items-center justify-center gap-1 text-sm font-semibold hover:border-motor"><span className="text-motor">{icon}</span>{label}</button>;
}

function CustomerVehicleStep({ customer, vehicle, onCustomer, onVehicle, onNext, initialQuery }: { customer: Customer | null; vehicle: Vehicle | null; onCustomer: (c: Customer | null) => void; onVehicle: (v: Vehicle) => void; onNext: () => void; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const dq = useDebounce(q, 250);
  const [newCustomer, setNewCustomer] = useState(false);
  const [newVehicle, setNewVehicle] = useState(false);
  const customers = useQuery({ queryKey: qk.customers(dq), queryFn: () => fetchers.customers(dq), enabled: dq.length >= 2 });
  const vehicles = useQuery({ queryKey: ["vehicles", dq], queryFn: () => api.get<{ items: Vehicle[] }>("/vehicles", { q: dq, limit: 20 }), enabled: dq.length >= 2 });
  const custVehicles = useQuery({ queryKey: qk.customer(customer?.id ?? ""), queryFn: () => fetchers.customer(customer!.id), enabled: !!customer });

  return (
    <div className="space-y-4">
      {!customer ? (
        <div className="card space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted" />
            <input autoFocus className="field pl-9 pr-12" placeholder="Placa, nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
            <PhotoInput variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onFiles={() => toast.info("Escribe la placa que ves en la foto")} aria-label="Foto de la placa"><span className="sr-only">Placa</span></PhotoInput>
          </div>
          {dq.length >= 2 && (
            <div className="space-y-1">
              {(vehicles.data?.items ?? []).map((v) => (
                <button key={v.id} onClick={() => { if (v.customer) { fetchers.customer(v.customer.id).then((c) => { onCustomer(c); onVehicle(v); onNext(); }); } }} className="w-full flex items-center gap-3 rounded-btn px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                  {v.plate && <span className="plate px-1.5 text-xs">{v.plate}</span>}
                  <span className="flex-1 text-sm"><span className="font-medium">{v.brand} {v.model}</span><span className="muted"> · {v.customer?.name}</span></span>
                </button>
              ))}
              {(customers.data?.items ?? []).map((c) => (
                <button key={c.id} onClick={() => onCustomer(c)} className="w-full flex items-center gap-3 rounded-btn px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                  <span className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">{c.name[0]}</span>
                  <span className="flex-1 text-sm"><span className="font-medium">{c.name}</span><span className="muted"> · {c.phone}</span></span>
                </button>
              ))}
              {customers.isFetched && !customers.data?.items.length && !vehicles.data?.items.length && <p className="text-sm muted px-3 py-2">Nada con “{dq}”.</p>}
            </div>
          )}
          <Button variant="outline" full icon={<UserPlus className="h-4 w-4" />} onClick={() => setNewCustomer(true)}>Crear cliente nuevo</Button>
        </div>
      ) : (
        <div className="card space-y-3">
          <div className="flex items-center justify-between"><div><div className="text-xs muted">Cliente</div><div className="font-semibold">{customer.name} <span className="muted font-normal text-sm">{customer.phone}</span></div></div><button className="text-sm text-motor-dark font-medium" onClick={() => { setQ(""); onCustomer(null); }}>Cambiar</button></div>
          <div className="text-xs muted">Vehículo</div>
          <div className="grid gap-2">
            {(custVehicles.data?.vehicles ?? []).map((v) => (
              <button key={v.id} onClick={() => onVehicle(v)} className={cn("flex items-center gap-3 rounded-btn border-2 px-3 py-2.5 text-left", vehicle?.id === v.id ? "border-motor bg-motor-soft dark:bg-motor/20" : "line")}>
                {v.plate ? <span className="plate px-1.5 text-xs">{v.plate}</span> : <span className="text-xs muted">sin placa</span>}
                <span className="text-sm font-medium">{v.brand} {v.model}</span>{v.lastKm ? <span className="text-xs muted ml-auto">{v.lastKm.toLocaleString("es-CO")} km</span> : null}
              </button>
            ))}
            <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setNewVehicle(true)}>Agregar vehículo</Button>
          </div>
          <Button full size="lg" disabled={!vehicle} onClick={onNext}>Continuar</Button>
        </div>
      )}
      <CustomerModal open={newCustomer} onClose={() => setNewCustomer(false)} onSaved={(c) => { setNewCustomer(false); onCustomer(c); setNewVehicle(true); }} />
      {customer && <VehicleModal open={newVehicle} customerId={customer.id} onClose={() => setNewVehicle(false)} onSaved={(v) => { setNewVehicle(false); custVehicles.refetch(); onVehicle(v); }} />}
    </div>
  );
}

function ProductPicker({ onPick, onClose }: { onPick: (p: Product) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const list = useQuery({ queryKey: qk.products({ q: dq, limit: 30 }), queryFn: () => fetchers.products({ q: dq, limit: 30 }) });
  return (
    <Modal open onClose={onClose} title="Agregar repuesto">
      <input autoFocus className="field mb-3" placeholder="Nombre, referencia, modelo…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.isLoading ? <Spinner /> : (
        <ul className="divide-y line">
          {(list.data?.items ?? []).map((p) => (
            <li key={p.id}><button onClick={() => onPick(p)} className="w-full flex items-center gap-3 py-2.5 text-left">
              {p.photos[0] ? <img src={assetUrl(p.photos[0].url)} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Package className="h-4 w-4 muted" /></span>}
              <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{p.name}</span><span className="block text-xs muted truncate">{[p.reference, p.brand, p.compatibleWith.join(", ")].filter(Boolean).join(" · ")}</span></span>
              <span className="text-right"><span className="block font-semibold tabular-nums text-sm">{formatMoney(p.price)}</span><StockBadge stock={p.stock} minStock={p.minStock} /></span>
            </button></li>
          ))}
          {list.data && !list.data.items.length && <li className="py-4 text-sm muted text-center">Sin resultados. Puedes agregarlo como “Otro”.</li>}
        </ul>
      )}
    </Modal>
  );
}

function ServicePicker({ onPick, onClose }: { onPick: (s: Service) => void; onClose: () => void }) {
  const list = useQuery({ queryKey: qk.services, queryFn: fetchers.services });
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const items = (list.data?.items ?? []).filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
    return items.reduce<Record<string, Service[]>>((acc, s) => ((acc[s.category] ??= []).push(s), acc), {});
  }, [list.data, q]);
  return (
    <Modal open onClose={onClose} title="Agregar servicio">
      <input autoFocus className="field mb-3" placeholder="Buscar servicio" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.isLoading ? <Spinner /> : Object.entries(groups).map(([cat, items]) => (
        <div key={cat} className="mb-3">
          <div className="text-xs font-semibold muted mb-1.5">{cat}</div>
          <div className="flex flex-wrap gap-2">
            {items.map((s) => (
              <button key={s.id} onClick={() => onPick(s)} className="rounded-full border line px-3 py-2 text-sm hover:border-motor hover:bg-motor-soft dark:hover:bg-motor/20">{s.name} <span className="muted tabular-nums">· {formatMoney(s.suggestedPrice)}</span></button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

function OtherPicker({ onPick, onClose }: { onPick: (d: string, p: number) => void; onClose: () => void }) {
  const [d, setD] = useState("");
  const [p, setP] = useState(0);
  return (
    <Modal open onClose={onClose} title="Otro concepto" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!d.trim()} onClick={() => onPick(d.trim(), p)}>Agregar</Button></>}>
      <Input label="Descripción" autoFocus value={d} onChange={(e) => setD(e.target.value)} placeholder="Ej. Soldadura de pata" />
      <MoneyInput label="Valor" value={p} onChange={setP} wrapClass="mt-3" />
    </Modal>
  );
}
