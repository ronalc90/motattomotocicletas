import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, Camera, ChevronLeft, Package, Pencil, Scale, Trash2 } from "lucide-react";
import { PRODUCT_CATEGORY_LABEL, formatMoney, type Product, type StockMovement } from "@motatto/shared";
import { api, assetUrl, errorMessage } from "@/lib/api";
import { qk } from "@/lib/queries";
import { useCan } from "@/hooks/useCan";
import { Badge, Button, Card, CardTitle, Checkbox, ConfirmDialog, EmptyState, Input, Modal, MoneyInput, PageHeader, PageLoader, PhotoInput, Stat, StockBadge, Textarea } from "@/components/ui";
import { ProductModal } from "@/components/inventory/ProductForm";
import { fmtDateTime } from "@/lib/utils";

type Full = Product & { movements: StockMovement[] };

const MV_LABEL: Record<string, string> = { entrada: "Entrada", salida: "Salida", ajuste: "Ajuste", devolucion: "Devolución" };
const MV_TONE: Record<string, "ok" | "bad" | "amber" | "blue"> = { entrada: "ok", salida: "bad", ajuste: "amber", devolucion: "blue" };

export function ProductDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery({ queryKey: qk.product(id), queryFn: () => api.get<Full>(`/products/${id}`) });
  const [edit, setEdit] = useState(false);
  const [entry, setEntry] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [deact, setDeact] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: qk.product(id) }); qc.invalidateQueries({ queryKey: ["products"] }); };
  const remove = useMutation({ mutationFn: () => api.delete(`/products/${id}`), onSuccess: () => { toast.success("Producto desactivado"); nav("/app/inventario"); }, onError: (e) => toast.error(errorMessage(e)) });
  async function addPhoto(files: File[]) { try { for (const f of files) await api.upload(`/products/${id}/photos`, f, "file", { source: "other" }); toast.success("Foto agregada"); refresh(); } catch (e) { toast.error(errorMessage(e)); } }
  if (q.isLoading) return <PageLoader />;
  const p = q.data;
  if (!p) return <EmptyState title="Producto no encontrado" />;
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader title={p.name} back={<Link to="/app/inventario" className="inline-flex items-center gap-1 text-sm muted mb-1"><ChevronLeft className="h-4 w-4" /> Inventario</Link>}
        sub={<span className="inline-flex items-center gap-2 flex-wrap">{p.reference && <span className="font-mono">{p.reference}</span>}{p.brand}<Badge>{PRODUCT_CATEGORY_LABEL[p.category]}</Badge>{!p.active && <Badge tone="bad">Inactivo</Badge>}</span>}
        action={<>
          {can("inventory:entry") && <Button variant="outline" size="icon" onClick={() => setEdit(true)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>}
          {can("inventory:manage") && <Button variant="ghost" size="icon" className="text-bad" onClick={() => setDeact(true)} aria-label="Desactivar"><Trash2 className="h-4 w-4" /></Button>}
        </>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Stock" value={<span className="inline-flex items-center gap-2">{p.stock}<StockBadge stock={p.stock} minStock={p.minStock} /></span>} sub={`mínimo ${p.minStock}`} />
        <Stat label="Precio de venta" value={`$ ${formatMoney(p.price)}`} tone="motor" />
        {can("inventory:cost") && <Stat label="Costo" value={`$ ${formatMoney(p.cost ?? 0)}`} sub={p.price > 0 ? `margen ${Math.round(((p.price - (p.cost ?? 0)) / p.price) * 100)}%` : undefined} />}
        {p.location && <Stat label="Ubicación" value={p.location} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {can("inventory:entry") && <Button icon={<ArrowDownToLine className="h-4 w-4" />} onClick={() => setEntry(true)}>Entrada</Button>}
        {can("inventory:manage") && <Button variant="secondary" icon={<Scale className="h-4 w-4" />} onClick={() => setAdjust(true)}>Ajustar (conteo)</Button>}
      </div>
      {p.compatibleWith.length > 0 && <div className="flex flex-wrap gap-1.5">{p.compatibleWith.map((c) => <Badge key={c} tone="blue">{c}</Badge>)}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle action={can("inventory:entry") && <PhotoInput size="sm" variant="outline" multiple onFiles={addPhoto}><Camera className="h-4 w-4" /> Foto</PhotoInput>}>Fotos</CardTitle>
          {!p.photos.length ? <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center muted"><Package className="h-6 w-6" /></div> : (
            <div className="grid grid-cols-3 gap-2">{p.photos.map((ph, i) => <a key={i} href={assetUrl(ph.url)} target="_blank" rel="noreferrer" className="relative"><img src={assetUrl(ph.url)} alt="" className="aspect-square w-full rounded-xl object-cover border line" />{ph.source === "label" && <span className="absolute bottom-1 left-1 rounded bg-ink/80 text-white text-[10px] px-1.5">etiqueta</span>}</a>)}</div>
          )}
        </Card>
        <Card>
          <CardTitle>Movimientos</CardTitle>
          {!p.movements.length ? <p className="text-sm muted">Sin movimientos.</p> : (
            <ul className="divide-y line -mx-4 sm:-mx-5">
              {p.movements.map((m) => (
                <li key={m.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-3 text-sm">
                  <Badge tone={MV_TONE[m.type]}>{MV_LABEL[m.type]}</Badge>
                  <span className="flex-1 min-w-0"><span className="block truncate">{m.note || m.supplier || (m.orderId ? <Link to={`/app/ordenes/${m.orderId}`} className="text-motor-dark">Ver orden</Link> : "—")}</span><span className="block text-xs muted">{fmtDateTime(m.createdAt)}{m.unitCost !== undefined && can("inventory:cost") ? ` · costo ${formatMoney(m.unitCost)}` : ""}</span></span>
                  <span className={`font-semibold tabular-nums ${m.qty >= 0 ? "text-ok" : "text-bad"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <ProductModal open={edit} initial={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); refresh(); }} />
      <EntryModal open={entry} product={p} onClose={() => setEntry(false)} onDone={() => { setEntry(false); refresh(); }} />
      <AdjustModal open={adjust} product={p} onClose={() => setAdjust(false)} onDone={() => { setAdjust(false); refresh(); }} />
      <ConfirmDialog open={deact} onClose={() => setDeact(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title="¿Desactivar producto?" message="Deja de aparecer en el inventario y en las búsquedas. El historial se conserva." confirmText="Desactivar" />
    </div>
  );
}

export function EntryModal({ open, product, onClose, onDone, photoUrl, defaultQty }: { open: boolean; product: Product; onClose: () => void; onDone: () => void; photoUrl?: string; defaultQty?: number }) {
  const can = useCan();
  const [qty, setQty] = useState(defaultQty ?? 1);
  const [unitCost, setUnitCost] = useState(product.cost ?? 0);
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [registerExpense, setRegisterExpense] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post(`/products/${product.id}/movements`, { type: "entrada", qty, unitCost: can("inventory:cost") ? unitCost : undefined, supplier, note, photoUrl: photoUrl || undefined, registerExpense }),
    onSuccess: () => { toast.success(`Entraron ${qty} de ${product.name}`); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title={`Entrada: ${product.name}`} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => m.mutate()} loading={m.isPending} disabled={qty < 1}>Registrar entrada</Button></>}>
      <p className="text-sm muted mb-3">Stock actual {product.stock} → <strong className="text-current">{product.stock + qty}</strong></p>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cantidad" type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} autoFocus />
        {can("inventory:cost") && <MoneyInput label="Costo unitario" value={unitCost} onChange={setUnitCost} />}
      </div>
      <Input label="Proveedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} wrapClass="mt-3" />
      <Textarea label="Nota" rows={2} value={note} onChange={(e) => setNote(e.target.value)} wrapClass="mt-3" />
      {can("cash:write") && can("inventory:cost") && <Checkbox label={<>Ya pagué: registrar como gasto {unitCost > 0 && <span className="muted">($ {formatMoney(qty * unitCost)})</span>}</>} checked={registerExpense} onChange={(e) => setRegisterExpense(e.target.checked)} />}
    </Modal>
  );
}

function AdjustModal({ open, product, onClose, onDone }: { open: boolean; product: Product; onClose: () => void; onDone: () => void }) {
  const [counted, setCounted] = useState(product.stock);
  const [note, setNote] = useState("");
  const delta = counted - product.stock;
  const m = useMutation({ mutationFn: () => api.post(`/products/${product.id}/adjust`, { countedQty: counted, note }), onSuccess: () => { toast.success("Stock ajustado"); onDone(); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Modal open={open} onClose={onClose} title="Ajustar por conteo" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => m.mutate()} loading={m.isPending} disabled={delta === 0}>Aplicar ajuste</Button></>}>
      <Input label="Cantidad real contada" type="number" min={0} inputMode="numeric" value={counted} onChange={(e) => setCounted(Math.max(0, Number(e.target.value) || 0))} autoFocus />
      <p className={`text-sm mt-2 ${delta === 0 ? "muted" : delta > 0 ? "text-ok" : "text-bad"}`}>{delta === 0 ? "Sin diferencia con el sistema." : `Diferencia: ${delta > 0 ? "+" : ""}${delta} (sistema ${product.stock} → ${counted})`}</p>
      <Textarea label="Motivo" rows={2} value={note} onChange={(e) => setNote(e.target.value)} wrapClass="mt-3" placeholder="Conteo mensual, rotura, extravío…" />
    </Modal>
  );
}
