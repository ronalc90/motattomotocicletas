import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Check, ChevronLeft, Image as ImageIcon, Sparkles, X } from "lucide-react";
import { PRODUCT_CATEGORY_LABEL, formatMoney, type LabelReadResult, type Product } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { Badge, Button, PageHeader, PhotoInput, Spinner } from "@/components/ui";
import { ProductModal } from "@/components/inventory/ProductForm";
import { EntryModal } from "./ProductDetail";
import { useQueryClient } from "@tanstack/react-query";

interface Shot { id: string; file: File; preview: string; status: "reading" | "done" | "error" | "saved"; result?: LabelReadResult; existing?: Product; error?: string; aiOff?: boolean }
let n = 0;

export function InventoryEntry() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState<Shot | null>(null);
  const [mode, setMode] = useState<"create" | "entry" | null>(null);
  const qc = useQueryClient();
  const nav = useNavigate();

  async function addFiles(files: File[]) {
    const news: Shot[] = files.map((file) => ({ id: `s${++n}`, file, preview: URL.createObjectURL(file), status: "reading" }));
    setShots((s) => [...news, ...s]);
    for (const shot of news) {
      try {
        const r = await api.upload<LabelReadResult>("/products/read-label", shot.file);
        let existing: Product | undefined;
        if (r.existingProductId) existing = await api.get<Product>(`/products/${r.existingProductId}`).catch(() => undefined);
        const aiOff = !r.rawText && r.confidence === 0;
        setShots((s) => s.map((x) => (x.id === shot.id ? { ...x, status: "done", result: r, existing, aiOff } : x)));
      } catch (e) {
        const msg = errorMessage(e);
        const aiOff = /IA no configurada|NOT_CONFIGURED/i.test(msg) || (e as { status?: number }).status === 501;
        setShots((s) => s.map((x) => (x.id === shot.id ? { ...x, status: aiOff ? "done" : "error", error: aiOff ? undefined : msg, aiOff, result: aiOff ? { compatibleWith: [], rawText: "", confidence: 0 } : undefined } : x)));
      }
    }
  }

  async function attachPhoto(productId: string, shot: Shot) {
    try { await api.upload(`/products/${productId}/photos`, shot.file, "file", { source: "label" }); } catch { /* photo is optional */ }
  }
  function done(shot: Shot, productId: string) {
    void attachPhoto(productId, shot);
    setShots((s) => s.map((x) => (x.id === shot.id ? { ...x, status: "saved" } : x)));
    setActive(null); setMode(null);
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <PageHeader title="Entrada por foto" sub="Toma la foto de la etiqueta. Puedes tomar varias seguidas." back={<Link to="/app/inventario" className="inline-flex items-center gap-1 text-sm muted mb-1"><ChevronLeft className="h-4 w-4" /> Inventario</Link>} />
      <div className="grid grid-cols-2 gap-2">
        <PhotoInput size="lg" multiple onFiles={addFiles}><Camera className="h-5 w-5" /> Cámara</PhotoInput>
        <PhotoInput size="lg" variant="secondary" multiple capture={false} onFiles={addFiles}><ImageIcon className="h-5 w-5" /> Galería</PhotoInput>
      </div>
      {shots.length === 0 && (
        <div className="card p-6 text-center text-sm muted">
          <Sparkles className="h-6 w-6 mx-auto mb-2 text-motor" />
          La IA lee referencia, nombre, marca, categoría y precio impreso. Si el producto ya existe, solo preguntamos cuántos entraron.
          <div className="mt-3"><Button variant="outline" size="sm" onClick={() => { setActive({ id: "manual", file: new File([], "x"), preview: "", status: "done", result: { compatibleWith: [], rawText: "", confidence: 0 } }); setMode("create"); }}>Crear a mano sin foto</Button></div>
        </div>
      )}
      <ul className="space-y-3">
        {shots.map((s) => (
          <li key={s.id} className="card p-3 flex gap-3">
            <img src={s.preview} alt="" className="h-24 w-24 rounded-xl object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              {s.status === "reading" && <div className="flex items-center gap-2 text-sm muted"><Spinner /> Leyendo etiqueta…</div>}
              {s.status === "error" && <div className="text-sm text-bad">{s.error}<div className="mt-2"><Button size="sm" variant="outline" onClick={() => { setActive(s); setMode("create"); }}>Crear a mano</Button></div></div>}
              {s.status === "saved" && <div className="text-sm text-ok font-medium inline-flex items-center gap-1"><Check className="h-4 w-4" /> Guardado</div>}
              {s.status === "done" && s.result && (
                <>
                  {s.aiOff && <p className="text-xs text-amber-800 dark:text-amber-200 mb-1">IA no configurada: llena los datos a mano. La foto se guarda en el producto.</p>}
                  {s.existing ? (
                    <div>
                      <Badge tone="ok" className="mb-1">Ya existe en tu inventario</Badge>
                      <div className="font-medium truncate">{s.existing.name}</div>
                      <div className="text-xs muted">{s.existing.reference} · stock {s.existing.stock} · {formatMoney(s.existing.price)}</div>
                      <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => { setActive(s); setMode("entry"); }}>¿Cuántos entraron?</Button><Button size="sm" variant="ghost" onClick={() => { setActive(s); setMode("create"); }}>Es otro producto</Button></div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium truncate">{s.result.name || <span className="muted">Sin nombre detectado</span>}</div>
                      <div className="text-xs muted truncate">{[s.result.reference, s.result.brand, s.result.category && PRODUCT_CATEGORY_LABEL[s.result.category], s.result.printedPrice && `impreso ${formatMoney(s.result.printedPrice)}`].filter(Boolean).join(" · ")}</div>
                      {s.result.compatibleWith.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{s.result.compatibleWith.map((c) => <Badge key={c} tone="blue">{c}</Badge>)}</div>}
                      <div className="mt-2 flex items-center gap-2"><Button size="sm" onClick={() => { setActive(s); setMode("create"); }}>Crear producto</Button>{s.result.confidence > 0 && <span className="text-xs muted">confianza {Math.round(s.result.confidence * 100)}%</span>}</div>
                    </div>
                  )}
                </>
              )}
            </div>
            <button className="self-start muted hover:text-bad" onClick={() => setShots((x) => x.filter((y) => y.id !== s.id))} aria-label="Quitar"><X className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>

      {active && mode === "create" && (
        <ProductModal open title="Nuevo producto desde la etiqueta" onClose={() => { setActive(null); setMode(null); }}
          defaults={{ name: active.result?.name ?? "", reference: active.result?.reference ?? "", barcode: active.result?.barcode ?? "", brand: active.result?.brand ?? "", category: active.result?.category ?? "otro", compatibleWith: active.result?.compatibleWith ?? [], price: active.result?.printedPrice ?? 0, initialStock: 1 }}
          onSaved={(p) => { if (active.id === "manual") { setActive(null); setMode(null); nav(`/app/inventario/${p.id}`); } else done(active, p.id); }} />
      )}
      {active && mode === "entry" && active.existing && (
        <EntryModal open product={active.existing} onClose={() => { setActive(null); setMode(null); }} onDone={() => done(active, active.existing!.id)} />
      )}
    </div>
  );
}
