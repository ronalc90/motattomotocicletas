import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import type { DeductRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type Deduct = Array<{ productId: string; qty: number }>;

/** F3: confirmation of which product lines to deduct from stock. */
export function DeductModal({ open, rows, onClose, onConfirm, loading, title = "¿Descontar del inventario?" }: { open: boolean; rows: DeductRow[]; onClose: () => void; onConfirm: (deduct: Deduct) => void; loading?: boolean; title?: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (open) setChecked(Object.fromEntries(rows.map((r) => [r.productId, r.stock > 0])));
  }, [open, rows]);
  const selected = rows.filter((r) => checked[r.productId]);
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="secondary" onClick={() => onConfirm([])} disabled={loading}>No descontar nada</Button>
        <Button onClick={() => onConfirm(selected.map((r) => ({ productId: r.productId, qty: r.qty })))} loading={loading} disabled={!selected.length}>Descontar lo marcado ({selected.length})</Button>
      </>}>
      <p className="text-sm muted mb-3">Desmarca lo que trajo el cliente o lo que no pasó por el estante.</p>
      <ul className="divide-y line border line rounded-xl overflow-hidden">
        {rows.map((r) => {
          const warn = r.stock <= 0 || r.after < 0;
          return (
            <li key={r.productId}>
              <label className="flex items-center gap-3 px-3 py-3 cursor-pointer min-h-[52px]">
                <input type="checkbox" className="h-5 w-5 accent-motor" checked={!!checked[r.productId]} onChange={(e) => setChecked((c) => ({ ...c, [r.productId]: e.target.checked }))} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{r.name}</span>
                  <span className={cn("block text-xs", warn ? "text-bad" : "muted")}>
                    {r.qty} ud · stock {r.stock} → {Math.max(r.stock - r.qty, r.after)}
                    {warn && <span className="inline-flex items-center gap-1 ml-2"><AlertTriangle className="h-3 w-3" /> sin stock</span>}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
