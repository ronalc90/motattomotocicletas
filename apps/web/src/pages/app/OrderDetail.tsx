import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Camera, ChevronLeft, Copy, Download, ExternalLink, MessageCircle, Pencil, ShieldCheck, Wallet, X } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_TRANSITIONS, PAYMENT_METHOD_LABEL, formatMoney, type Order, type OrderStatus } from "@motatto/shared";
import { api, apiFileUrl, assetUrl, errorMessage } from "@/lib/api";
import { fetchers, qk, type DeductRow, type InvoiceResponse } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/hooks/useCan";
import { Badge, Button, Card, CardTitle, EmptyState, Modal, PageHeader, PageLoader, PhotoInput, Row, StatusBadge, Textarea } from "@/components/ui";
import { DeductModal, type Deduct } from "@/components/orders/DeductModal";
import { PayModal, type PayInput } from "@/components/orders/PayModal";
import { downloadInvoicePdf } from "@/components/invoice/downloadPdf";
import { copyText, fmtDate, fmtDateTime } from "@/lib/utils";

export function OrderDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const { tenant } = useAuth();
  const q = useQuery({ queryKey: qk.order(id), queryFn: () => fetchers.order(id) });
  const inv = useQuery({ queryKey: qk.invoice(id), queryFn: () => api.get<InvoiceResponse>(`/orders/${id}/invoice`), enabled: !!q.data });
  const o = q.data;

  const [deduct, setDeduct] = useState<{ rows: DeductRow[]; next: "terminada" | "pay"; pay?: PayInput } | null>(null);
  const [pay, setPay] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: qk.order(id) }); qc.invalidateQueries({ queryKey: qk.invoice(id) }); qc.invalidateQueries({ queryKey: ["orders"] }); qc.invalidateQueries({ queryKey: qk.dashboard }); };

  const status = useMutation({
    mutationFn: async ({ status, deduct, voidReason }: { status: OrderStatus; deduct?: Deduct; voidReason?: string }) => api.post<Order>(`/orders/${id}/status`, { status, deduct, voidReason }),
    onSuccess: (r) => { toast.success(`Orden ${ORDER_STATUS_LABEL[r.status].toLowerCase()}`); setDeduct(null); setVoidOpen(false); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const payMut = useMutation({
    mutationFn: async ({ p, deduct }: { p: PayInput; deduct?: Deduct }) => api.post<Order>(`/orders/${id}/pay`, { ...p, reference: p.reference || undefined, deduct }),
    onSuccess: () => { toast.success("Pago registrado"); setPay(false); setDeduct(null); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function changeStatus(s: OrderStatus) {
    if (s === "anulada") { setVoidOpen(true); return; }
    if (s === "terminada" && (tenant?.settings.askStockOnClose ?? true)) {
      const rows = await api.get<DeductRow[]>(`/orders/${id}/deduct-preview`).catch(() => []);
      if (rows.length) { setDeduct({ rows, next: "terminada" }); return; }
    }
    status.mutate({ status: s });
  }
  async function onPay(p: PayInput) {
    const rows = await api.get<DeductRow[]>(`/orders/${id}/deduct-preview`).catch(() => []);
    if (rows.length) { setPay(false); setDeduct({ rows, next: "pay", pay: p }); return; }
    payMut.mutate({ p });
  }
  function onDeductConfirm(d: Deduct) {
    if (!deduct) return;
    if (deduct.next === "terminada") status.mutate({ status: "terminada", deduct: d });
    else if (deduct.pay) payMut.mutate({ p: deduct.pay, deduct: d });
  }
  async function pdf() {
    if (!inv.data) return;
    setPdfBusy(true);
    try { await downloadInvoicePdf(inv.data.invoice, assetUrl(inv.data.invoice.tenant.logoUrl)); }
    catch { window.open(apiFileUrl(`/orders/${id}/pdf`), "_blank"); }
    finally { setPdfBusy(false); }
  }
  async function addPhoto(files: File[]) {
    try { for (const f of files) await api.upload(`/orders/${id}/photos`, f); toast.success("Foto agregada"); refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
  }

  if (q.isLoading) return <PageLoader />;
  if (!o) return <EmptyState title="Orden no encontrada" action={<Link to="/app/ordenes"><Button variant="secondary">Volver</Button></Link>} />;

  const locked = o.status === "pagada" || o.status === "anulada";
  const transitions = ORDER_TRANSITIONS[o.status].filter((s) => s !== "pagada" && (s !== "anulada" || can("orders:void")) && (s !== "terminada" || can("orders:finish")));
  const payable = ["recibida", "cotizada", "en_proceso", "terminada"].includes(o.status) && can("orders:pay");
  const warrantyActive = o.warrantyUntil && new Date(o.warrantyUntil) >= new Date() && o.status === "pagada";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader title={<span className="inline-flex items-center gap-3 flex-wrap">{o.number}<StatusBadge status={o.status} /></span>}
        back={<button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm muted mb-1"><ChevronLeft className="h-4 w-4" /> Órdenes</button>}
        sub={<>Creada {fmtDateTime(o.createdAt)}{o.paidAt && ` · Pagada ${fmtDateTime(o.paidAt)}`}{o.warrantyOfOrderId && <> · <Link className="text-ok font-medium" to={`/app/ordenes/${o.warrantyOfOrderId}`}>garantía de otra orden</Link></>}</>}
        action={!locked && can("orders:write") && <Link to={`/app/ordenes/${o.id}/editar`}><Button variant="outline" icon={<Pencil className="h-4 w-4" />}>Editar</Button></Link>} />

      {/* primary actions */}
      <div className="flex flex-wrap gap-2">
        {payable && <Button onClick={() => setPay(true)} icon={<Wallet className="h-4 w-4" />}>Cobrar</Button>}
        {transitions.filter((s) => s !== "anulada").map((s) => (
          <Button key={s} variant={s === "terminada" ? "dark" : "secondary"} onClick={() => changeStatus(s)} loading={status.isPending && status.variables?.status === s}>{s === "terminada" ? "Marcar terminada" : `Pasar a ${ORDER_STATUS_LABEL[s].toLowerCase()}`}</Button>
        ))}
        {transitions.includes("anulada") && <Button variant="ghost" className="text-bad" onClick={() => setVoidOpen(true)} icon={<Ban className="h-4 w-4" />}>Anular</Button>}
        {o.status === "pagada" && can("orders:write") && <Button variant="outline" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => nav("/app/ordenes/nueva", { state: { customerId: o.customerId, vehicleId: o.vehicleId, warrantyOfOrderId: o.id } })}>Nueva orden de garantía</Button>}
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs muted">Cliente</div>
                <Link to={`/app/clientes/${o.customerId}`} className="font-semibold hover:text-motor">{o.customer?.name}</Link>
                {o.customer?.phone && <div className="text-sm muted">{o.customer.phone}</div>}
                <div className="text-xs muted mt-2">Vehículo</div>
                <Link to={`/app/vehiculos/${o.vehicleId}`} className="font-semibold hover:text-motor">{o.vehicle?.brand} {o.vehicle?.model}</Link>
                {o.km ? <div className="text-sm muted">{o.km.toLocaleString("es-CO")} km</div> : null}
              </div>
              {o.vehicle?.plate && <span className="plate px-2.5 py-1 text-base">{o.vehicle.plate}</span>}
            </div>
            {o.description && <p className="mt-3 text-sm whitespace-pre-line border-t line pt-3">{o.description}</p>}
            {o.internalNotes && <p className="mt-2 text-xs muted whitespace-pre-line"><span className="font-semibold">Notas internas:</span> {o.internalNotes}</p>}
            {o.voidReason && <p className="mt-3 text-sm text-bad border-t line pt-3"><span className="font-semibold">Anulada:</span> {o.voidReason}</p>}
          </Card>

          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b line text-xs muted text-left"><th className="px-4 py-2.5 font-medium">Descripción</th><th className="px-2 py-2.5 font-medium text-right">Cant.</th><th className="px-4 py-2.5 font-medium text-right">Valor</th></tr></thead>
              <tbody>
                {o.items.map((it) => {
                  const ded = o.stockDeducted.find((d) => d.productId === it.productId);
                  return (
                    <tr key={it.id} className="border-b line last:border-0">
                      <td className="px-4 py-2.5"><div>{it.description}</div><div className="text-xs muted">{it.type}{ded ? ` · descontado ${ded.qty}` : ""}{it.unitPrice !== it.total / it.qty ? "" : ""}</div></td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{it.qty}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(it.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60">
              <Row label="Subtotal" value={formatMoney(o.subtotal)} />
              {o.discount > 0 && <Row label="Descuento" value={`-${formatMoney(o.discount)}`} />}
              {o.surcharge > 0 && <Row label={`Recargo ${o.surchargeMethod ? PAYMENT_METHOD_LABEL[o.surchargeMethod] : ""}`} value={formatMoney(o.surcharge)} />}
              <Row label="Total" value={`$ ${formatMoney(o.total)}`} strong />
            </div>
          </Card>

          {(o.photos.length > 0 || (!locked && can("orders:write"))) && (
            <Card>
              <CardTitle action={!locked && can("orders:write") && <PhotoInput size="sm" variant="outline" multiple onFiles={addPhoto}><Camera className="h-4 w-4" /> Agregar</PhotoInput>}>Fotos</CardTitle>
              {o.photos.length === 0 ? <p className="text-sm muted">Sin fotos.</p> : (
                <div className="flex flex-wrap gap-2">{o.photos.map((p) => <a key={p} href={assetUrl(p)} target="_blank" rel="noreferrer"><img src={assetUrl(p)} alt="" className="h-24 w-24 rounded-xl object-cover border line" /></a>)}</div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Cuenta de cobro</CardTitle>
            <div className="grid gap-2">
              {inv.data?.whatsappUrl && <a href={inv.data.whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-btn bg-ok text-white h-11 font-semibold text-[15px]"><MessageCircle className="h-4 w-4" /> Enviar por WhatsApp</a>}
              <Button variant="secondary" onClick={() => inv.data && copyText(inv.data.text).then(() => toast.success("Texto copiado"))} disabled={!inv.data} icon={<Copy className="h-4 w-4" />}>Copiar texto</Button>
              <Button variant="secondary" onClick={pdf} loading={pdfBusy} disabled={!inv.data} icon={<Download className="h-4 w-4" />}>Descargar PDF</Button>
              {inv.data?.publicUrl && <a href={inv.data.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-btn border line h-11 font-semibold text-[15px] hover:bg-slate-50 dark:hover:bg-slate-800"><ExternalLink className="h-4 w-4" /> Ver link público</a>}
              {inv.data?.publicUrl && <button className="text-xs muted hover:text-motor" onClick={() => copyText(inv.data!.publicUrl).then(() => toast.success("Link copiado"))}>Copiar link público</button>}
            </div>
          </Card>

          {warrantyActive && <div className="rounded-card bg-ok-soft text-ok p-4 text-sm font-medium flex gap-2"><ShieldCheck className="h-5 w-5 shrink-0" /> Garantía vigente hasta {fmtDate(o.warrantyUntil)}</div>}
          {o.warrantyUntil && !warrantyActive && o.status === "pagada" && <div className="text-xs muted px-1">Garantía venció el {fmtDate(o.warrantyUntil)}</div>}

          <Card>
            <CardTitle>Línea de tiempo</CardTitle>
            <ol className="relative border-l-2 line ml-2 space-y-3 text-sm">
              <Tl label="Creada" at={o.createdAt} />
              {o.paidAt && <Tl label="Pagada" at={o.paidAt} />}
              {o.voidedAt && <Tl label="Anulada" at={o.voidedAt} tone="bad" />}
              {!o.paidAt && !o.voidedAt && <Tl label={ORDER_STATUS_LABEL[o.status]} at={o.updatedAt} />}
            </ol>
            {(o.payments ?? []).length > 0 && (
              <div className="mt-4 border-t line pt-3 space-y-1 text-sm">
                <div className="text-xs muted mb-1">Pagos</div>
                {o.payments!.map((p) => (
                  <div key={p.id} className="flex justify-between gap-2"><span>{PAYMENT_METHOD_LABEL[p.method]}{p.reference && <span className="muted"> · {p.reference}</span>}{p.voided && <Badge tone="bad" className="ml-1">anulado</Badge>}</span><span className="tabular-nums font-medium">{formatMoney(p.amount)}</span></div>
                ))}
              </div>
            )}
            {o.source === "voz" && <div className="mt-3 text-xs muted">Creada por voz{o.voiceTranscript ? `: “${o.voiceTranscript}”` : ""}</div>}
          </Card>
        </div>
      </div>

      <DeductModal open={!!deduct} rows={deduct?.rows ?? []} onClose={() => setDeduct(null)} onConfirm={onDeductConfirm} loading={status.isPending || payMut.isPending} />
      <PayModal open={pay} order={o} tenant={tenant} onClose={() => setPay(false)} onConfirm={onPay} loading={payMut.isPending} />
      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title={`Anular ${o.number}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setVoidOpen(false)}>Cancelar</Button><Button variant="danger" disabled={voidReason.trim().length < 3} loading={status.isPending} onClick={() => status.mutate({ status: "anulada", voidReason: voidReason.trim() })} icon={<X className="h-4 w-4" />}>Anular orden</Button></>}>
        <p className="text-sm muted mb-3">Se devuelve al inventario lo descontado y el pago queda anulado. El número no se reutiliza.</p>
        <Textarea label="Motivo" autoFocus value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Ej. El cliente no aprobó el trabajo" />
      </Modal>
    </div>
  );
}

function Tl({ label, at, tone }: { label: string; at: string; tone?: "bad" }) {
  return (
    <li className="pl-4 relative">
      <span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ${tone === "bad" ? "bg-bad" : "bg-motor"}`} />
      <div className="font-medium">{label}</div><div className="text-xs muted">{fmtDateTime(at)}</div>
    </li>
  );
}
