import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABEL, formatMoney, type CashClosing, type CashClosingTotals, type Expense, type Paginated, type Payment } from "@motatto/shared";
import { api, assetUrl, errorMessage } from "@/lib/api";
import { qk } from "@/lib/queries";
import { useCan } from "@/hooks/useCan";
import { Badge, Button, Card, CardTitle, ConfirmDialog, Input, Modal, MoneyInput, PageHeader, PageLoader, PhotoInput, Select, Stat } from "@/components/ui";
import { fmtDateTime, fmtDay, todayStr } from "@/lib/utils";

interface DayData { date: string; totals: CashClosingTotals; closing: CashClosing | null; payments: Array<Payment & { orderNumber?: string }>; expenses: Expense[] }
const EXP_LABEL: Record<string, string> = { repuestos: "Repuestos", arriendo: "Arriendo", servicios: "Servicios", herramienta: "Herramienta", nomina: "Nómina", otro: "Otro" };

export function Cash() {
  const [date, setDate] = useState(todayStr());
  const qc = useQueryClient();
  const can = useCan();
  const day = useQuery({ queryKey: qk.cashDay(date), queryFn: () => api.get<DayData>("/cash/day", { date }) });
  const closings = useQuery({ queryKey: qk.closings, queryFn: () => api.get<Paginated<CashClosing>>("/cash/closings") });
  const [addExp, setAddExp] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [delExp, setDelExp] = useState<Expense | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: qk.cashDay(date) }); qc.invalidateQueries({ queryKey: qk.closings }); qc.invalidateQueries({ queryKey: qk.dashboard }); };
  const close = useMutation({ mutationFn: () => api.post("/cash/close", { date }), onSuccess: () => { toast.success("Día cerrado"); setCloseOpen(false); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const reopen = useMutation({ mutationFn: () => api.post("/cash/reopen", { date }), onSuccess: () => { toast.success("Día reabierto"); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const removeExp = useMutation({ mutationFn: (id: string) => api.delete(`/expenses/${id}`), onSuccess: () => { toast.success("Gasto eliminado"); setDelExp(null); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const d = day.data;
  const closed = !!d?.closing && !d.closing.reopened;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader title="Caja" sub={closed ? <Badge tone="ok"><Lock className="h-3 w-3" /> Día cerrado</Badge> : <Badge tone="amber"><Unlock className="h-3 w-3" /> Día abierto</Badge>}
        action={<>
          <input type="date" className="field w-auto" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          {can("cash:write") && !closed && <Button variant="dark" onClick={() => setCloseOpen(true)} icon={<Lock className="h-4 w-4" />}>Cerrar día</Button>}
          {can("cash:reopen") && closed && <Button variant="outline" onClick={() => reopen.mutate()} loading={reopen.isPending} icon={<Unlock className="h-4 w-4" />}>Reabrir</Button>}
        </>} />
      {day.isLoading || !d ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Ventas" value={`$ ${formatMoney(d.totals.sales)}`} sub={`${d.payments.filter((p) => !p.voided).length} pagos`} tone="motor" />
            <Stat label="Efectivo" value={`$ ${formatMoney(d.totals.efectivo)}`} />
            <Stat label="Nequi" value={`$ ${formatMoney(d.totals.nequi)}`} sub={d.totals.surcharges ? `recargos ${formatMoney(d.totals.surcharges)}` : undefined} />
            <Stat label="Transferencia / otro" value={`$ ${formatMoney(d.totals.transferencia + d.totals.otro)}`} />
            <Stat label="Gastos" value={`$ ${formatMoney(d.totals.expenses)}`} tone="bad" />
            <Stat label="Neto del día" value={`$ ${formatMoney(d.totals.net)}`} tone="dark" className="col-span-2 lg:col-span-1" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardTitle>Pagos</CardTitle>
              {!d.payments.length ? <p className="text-sm muted">Sin pagos este día.</p> : (
                <ul className="divide-y line -mx-4 sm:-mx-5">
                  {d.payments.map((p) => (
                    <li key={p.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-3 text-sm">
                      <Badge tone={p.method === "efectivo" ? "ok" : p.method === "nequi" ? "violet" : "blue"}>{PAYMENT_METHOD_LABEL[p.method]}</Badge>
                      <span className="flex-1 min-w-0"><Link to={`/app/ordenes/${p.orderId}`} className="font-medium hover:text-motor">{p.orderNumber ?? "Orden"}</Link><span className="block text-xs muted">{fmtDateTime(p.createdAt)}{p.reference && ` · ${p.reference}`}</span></span>
                      <span className={`font-semibold tabular-nums ${p.voided ? "line-through muted" : ""}`}>{formatMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardTitle action={can("cash:write") && !closed && <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setAddExp(true)}>Gasto</Button>}>Gastos</CardTitle>
              {!d.expenses.length ? <p className="text-sm muted">Sin gastos este día.</p> : (
                <ul className="divide-y line -mx-4 sm:-mx-5">
                  {d.expenses.map((e) => (
                    <li key={e.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-3 text-sm">
                      {e.receiptPhotoUrl ? <a href={assetUrl(e.receiptPhotoUrl)} target="_blank" rel="noreferrer"><img src={assetUrl(e.receiptPhotoUrl)} alt="" className="h-9 w-9 rounded-lg object-cover" /></a> : <Badge>{EXP_LABEL[e.category]}</Badge>}
                      <span className="flex-1 min-w-0"><span className="block truncate">{e.concept}</span><span className="block text-xs muted">{EXP_LABEL[e.category]}</span></span>
                      <span className="font-semibold tabular-nums text-bad">-{formatMoney(e.amount)}</span>
                      {can("cash:write") && !e.closingId && <button className="muted hover:text-bad p-1" onClick={() => setDelExp(e)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
      <Card>
        <CardTitle>Cierres anteriores</CardTitle>
        {!closings.data?.items.length ? <p className="text-sm muted">Todavía no has cerrado ningún día.</p> : (
          <ul className="divide-y line -mx-4 sm:-mx-5">
            {closings.data.items.slice(0, 30).map((c) => (
              <li key={c.id}><button onClick={() => setDate(c.date)} className="w-full px-4 sm:px-5 py-2.5 flex items-center gap-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="w-24 font-medium capitalize">{fmtDay(c.date)}</span>
                {c.reopened ? <Badge tone="amber">reabierto</Badge> : <Badge tone="ok">cerrado</Badge>}
                <span className="flex-1 text-xs muted">ventas {formatMoney(c.totals.sales)} · gastos {formatMoney(c.totals.expenses)}</span>
                <span className="font-semibold tabular-nums">{formatMoney(c.totals.net)}</span>
              </button></li>
            ))}
          </ul>
        )}
      </Card>
      <ExpenseModal open={addExp} date={date} onClose={() => setAddExp(false)} onSaved={() => { setAddExp(false); refresh(); }} />
      <ConfirmDialog open={closeOpen} onClose={() => setCloseOpen(false)} onConfirm={() => close.mutate()} loading={close.isPending} title={`¿Cerrar el ${fmtDay(date)}?`} message={d && <>Se guardan los totales: ventas <strong>{formatMoney(d.totals.sales)}</strong>, gastos <strong>{formatMoney(d.totals.expenses)}</strong>, neto <strong>{formatMoney(d.totals.net)}</strong>. Después no se pueden registrar gastos en ese día sin reabrirlo.</>} confirmText="Cerrar día" />
      <ConfirmDialog open={!!delExp} onClose={() => setDelExp(null)} onConfirm={() => delExp && removeExp.mutate(delExp.id)} loading={removeExp.isPending} danger title="¿Eliminar gasto?" message={delExp?.concept} confirmText="Eliminar" />
    </div>
  );
}

function ExpenseModal({ open, date, onClose, onSaved }: { open: boolean; date: string; onClose: () => void; onSaved: () => void }) {
  const [concept, setConcept] = useState("");
  const [category, setCategory] = useState("otro");
  const [amount, setAmount] = useState(0);
  const [photo, setPhoto] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const m = useMutation({ mutationFn: () => api.post("/expenses", { concept, category, amount, date, receiptPhotoUrl: photo || undefined }), onSuccess: () => { toast.success("Gasto registrado"); setConcept(""); setAmount(0); setPhoto(""); onSaved(); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Modal open={open} onClose={onClose} title="Registrar gasto" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => m.mutate()} loading={m.isPending} disabled={concept.trim().length < 2 || amount <= 0}>Guardar gasto</Button></>}>
      <Input label="Concepto" autoFocus value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Almuerzo, aceite para el taller…" />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Select label="Categoría" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXP_LABEL[c] }))} value={category} onChange={(e) => setCategory(e.target.value)} />
        <MoneyInput label="Valor" value={amount} onChange={setAmount} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        {photo && <img src={assetUrl(photo)} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <PhotoInput variant="outline" size="sm" loading={uploading} onFiles={async ([f]) => { setUploading(true); try { const r = await api.upload<{ url: string }>("/uploads", f, "file", { folder: "expenses" }); setPhoto(r.url); } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); } }}><Camera className="h-4 w-4" /> Foto del recibo</PhotoInput>
      </div>
    </Modal>
  );
}
