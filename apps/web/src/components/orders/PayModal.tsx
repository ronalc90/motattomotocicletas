import { useEffect, useState } from "react";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, computeTotals, formatMoney, type Order, type PaymentMethod, type Tenant } from "@motatto/shared";
import { Button, Input, Modal, MoneyInput, Row } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PayInput { method: PaymentMethod; amount: number; reference?: string }

export function PayModal({ open, order, tenant, onClose, onConfirm, loading }: { open: boolean; order: Order; tenant: Tenant | null; onClose: () => void; onConfirm: (p: PayInput) => void; loading?: boolean }) {
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [amount, setAmount] = useState(order.total);
  const [reference, setReference] = useState("");
  const pct = tenant?.settings.surcharges.find((s) => s.method === method)?.pct ?? 0;
  const totals = computeTotals(order.items, order.discount, pct);
  useEffect(() => { if (open) { setMethod("efectivo"); setReference(""); } }, [open]);
  useEffect(() => { setAmount(totals.total); }, [totals.total]);
  return (
    <Modal open={open} onClose={onClose} title={`Cobrar ${order.number}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onConfirm({ method, amount, reference })} loading={loading}>Registrar pago de $ {formatMoney(amount)}</Button></>}>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {PAYMENT_METHODS.map((m) => {
          const p = tenant?.settings.surcharges.find((s) => s.method === m)?.pct ?? 0;
          return (
            <button key={m} type="button" onClick={() => setMethod(m)} className={cn("rounded-btn border-2 px-3 py-3 text-left min-h-[56px]", method === m ? "border-motor bg-motor-soft dark:bg-motor/20" : "line")}>
              <span className="block font-semibold">{PAYMENT_METHOD_LABEL[m]}</span>
              <span className="block text-xs muted">{p > 0 ? `+${p}% recargo` : "sin recargo"}</span>
            </button>
          );
        })}
      </div>
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 mb-4 text-sm">
        <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
        {totals.discount > 0 && <Row label="Descuento" value={`-${formatMoney(totals.discount)}`} />}
        {totals.surcharge > 0 && <Row label={`Recargo ${PAYMENT_METHOD_LABEL[method]} (${pct}%)`} value={formatMoney(totals.surcharge)} />}
        <Row label="Total a cobrar" value={`$ ${formatMoney(totals.total)}`} strong />
      </div>
      <MoneyInput label="Monto recibido" value={amount} onChange={setAmount} hint="Se registra este valor en caja." />
      <Input label="Referencia (opcional)" placeholder="Nº de comprobante Nequi" value={reference} onChange={(e) => setReference(e.target.value)} wrapClass="mt-3" />
    </Modal>
  );
}
