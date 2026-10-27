import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Camera, Download, Package, Plus, Upload } from "lucide-react";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABEL, formatMoney, type Product } from "@motatto/shared";
import { api, assetUrl, downloadBlob, errorMessage } from "@/lib/api";
import { fetchers, qk } from "@/lib/queries";
import { useDebounce } from "@/hooks/useDebounce";
import { useCan } from "@/hooks/useCan";
import { Button, EmptyState, Modal, PageHeader, PageLoader, SearchBox, Select, StockBadge } from "@/components/ui";
import { ProductModal } from "@/components/inventory/ProductForm";
import { cn, todayStr } from "@/lib/utils";

export function Inventory() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounce(q, 250);
  const category = sp.get("cat") ?? "";
  const low = sp.get("low") === "1";
  const can = useCan();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [fab, setFab] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const params = { q: dq || undefined, category: category || undefined, lowStock: low ? "1" : undefined, limit: 200 };
  const list = useQuery({ queryKey: qk.products(params), queryFn: () => fetchers.products(params) });
  const exportX = useMutation({ mutationFn: () => api.blob("/products/export"), onSuccess: (b) => downloadBlob(b, `inventario-${todayStr()}.xlsx`), onError: (e) => toast.error(errorMessage(e)) });
  const importX = useMutation({
    mutationFn: (f: File) => api.upload<{ created: number; updated: number; errors: Array<{ row: number; message: string }> }>("/products/import", f),
    onSuccess: (r) => { toast.success(`Importado: ${r.created} nuevos, ${r.updated} actualizados${r.errors.length ? `, ${r.errors.length} con error` : ""}`); if (r.errors.length) console.warn(r.errors); setImportOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: string, v: string) => setSp((s) => { if (v) s.set(k, v); else s.delete(k); return s; });

  return (
    <div>
      <PageHeader title="Inventario" sub={list.data ? `${list.data.total} productos` : undefined}
        action={<div className="hidden sm:flex gap-2">
          <Button variant="outline" onClick={() => exportX.mutate()} loading={exportX.isPending} icon={<Download className="h-4 w-4" />}>Excel</Button>
          {can("inventory:manage") && <Button variant="outline" onClick={() => setImportOpen(true)} icon={<Upload className="h-4 w-4" />}>Importar</Button>}
          {can("inventory:entry") && <Link to="/app/inventario/entrada"><Button variant="dark" icon={<Camera className="h-4 w-4" />}>Entrada por foto</Button></Link>}
          {can("inventory:entry") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreate(true)}>Nuevo</Button>}
        </div>} />
      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_200px_auto] gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Nombre, referencia, modelo…" className="col-span-2 sm:col-span-1" />
        <Select options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: PRODUCT_CATEGORY_LABEL[c] }))} placeholder="Todas las categorías" value={category} onChange={(e) => set("cat", e.target.value)} />
        <button onClick={() => set("low", low ? "" : "1")} className={cn("rounded-btn border px-3 h-11 text-sm font-medium whitespace-nowrap", low ? "bg-bad-soft text-bad border-bad/30" : "line")}>Stock bajo</button>
      </div>
      <div className="sm:hidden flex gap-2 mb-3 text-xs">
        <button className="muted underline" onClick={() => exportX.mutate()}>Exportar Excel</button>
        {can("inventory:manage") && <button className="muted underline" onClick={() => setImportOpen(true)}>Importar</button>}
      </div>
      {list.isLoading ? <PageLoader /> : !list.data?.items.length ? (
        <EmptyState icon={<Boxes />} title="Sin productos" text={dq || category || low ? "Nada con esos filtros." : "Toma una foto de la etiqueta de tu primer repuesto o créalo a mano."} action={can("inventory:entry") && <Link to="/app/inventario/entrada"><Button icon={<Camera className="h-4 w-4" />}>Entrada por foto</Button></Link>} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {list.data.items.map((p) => <ProductRow key={p.id} p={p} onClick={() => nav(`/app/inventario/${p.id}`)} />)}
        </ul>
      )}
      {can("inventory:entry") && (
        <div className="sm:hidden fixed right-4 bottom-20 z-20 flex flex-col items-end gap-2">
          {fab && <>
            <Link to="/app/inventario/entrada" className="rounded-full bg-ink text-white px-4 h-11 flex items-center gap-2 text-sm font-semibold shadow-float"><Camera className="h-4 w-4" /> Entrada por foto</Link>
            <button onClick={() => { setFab(false); setCreate(true); }} className="rounded-full bg-[var(--card)] border line px-4 h-11 flex items-center gap-2 text-sm font-semibold shadow-float"><Package className="h-4 w-4" /> Nuevo producto</button>
          </>}
          <button onClick={() => setFab((v) => !v)} aria-label="Acciones" className={cn("h-14 w-14 rounded-full bg-motor text-white shadow-float flex items-center justify-center transition-transform", fab && "rotate-45")}><Plus className="h-6 w-6" /></button>
        </div>
      )}
      <ProductModal open={create} onClose={() => setCreate(false)} onSaved={(p) => { setCreate(false); qc.invalidateQueries({ queryKey: ["products"] }); nav(`/app/inventario/${p.id}`); }} />
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar desde Excel o CSV" size="sm">
        <p className="text-sm muted mb-3">Columnas: <code>nombre, referencia, codigo, marca, categoria, compatible, costo, precio, stock, stock_minimo, ubicacion</code>. Si la referencia o el nombre ya existen, se actualiza el producto.</p>
        <input type="file" accept=".xlsx,.csv" className="field" onChange={(e) => { const f = e.target.files?.[0]; if (f) importX.mutate(f); }} disabled={importX.isPending} />
        {importX.isPending && <p className="text-sm muted mt-2">Importando…</p>}
      </Modal>
    </div>
  );
}

function ProductRow({ p, onClick }: { p: Product; onClick: () => void }) {
  return (
    <li onClick={onClick} className="card p-3 flex items-center gap-3 cursor-pointer hover:border-motor">
      {p.photos[0] ? <img src={assetUrl(p.photos[0].url)} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" /> : <span className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><Package className="h-5 w-5 muted" /></span>}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{p.name}</div>
        <div className="text-xs muted truncate">{[p.reference, p.brand, PRODUCT_CATEGORY_LABEL[p.category]].filter(Boolean).join(" · ")}</div>
        <div className="mt-1 flex items-center gap-2"><StockBadge stock={p.stock} minStock={p.minStock} /><span className="text-sm font-semibold tabular-nums ml-auto">{formatMoney(p.price)}</span></div>
      </div>
    </li>
  );
}
