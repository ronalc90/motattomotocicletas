import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, ExternalLink, UserPlus, PackagePlus, Package } from "lucide-react";
import { formatMoney, type AssistantAction } from "@motatto/shared";
import { api, apiFileUrl, errorMessage } from "@/lib/api";
import { Badge, Button } from "@/components/ui";

/** Tarjeta de una acción propuesta por el asistente. Nada se guarda hasta que el usuario confirma. */
export function ActionCard({ action }: { action: AssistantAction }) {
  switch (action.kind) {
    case "crear_producto":
      return <CreateProduct a={action} />;
    case "crear_cliente":
      return <CreateCustomer a={action} />;
    case "entrada_stock":
      return <StockEntry a={action} />;
    case "imprimir_factura":
      return <PrintInvoice a={action} />;
    case "consultar_inventario":
      return <InventoryList a={action} />;
  }
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-card border line bg-white dark:bg-slate-900 p-3 text-sm space-y-2">
      <div className="flex items-center gap-2 font-semibold">{icon}<span>{title}</span></div>
      {children}
    </div>
  );
}

function useDone() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

/** Pregunta si quiere tomarle foto al producto (se guarda con el producto). */
function PhotoPrompt({ productId }: { productId: string }) {
  const [state, setState] = useState<"ask" | "saving" | "saved" | "skipped">("ask");
  const input = useRef<HTMLInputElement>(null);
  const done = useDone();

  async function onFile(file?: File) {
    if (!file) return;
    setState("saving");
    try {
      await api.upload(`/products/${productId}/photos`, file, "file", { source: "other" });
      setState("saved");
      toast.success("Foto guardada con el producto");
      done();
    } catch (e) {
      setState("ask");
      toast.error(errorMessage(e));
    }
  }

  if (state === "saved") return <p className="text-ok flex items-center gap-1.5"><Check className="h-4 w-4" /> Foto guardada con el producto.</p>;
  if (state === "skipped") return null;
  return (
    <div className="rounded-btn bg-slate-50 dark:bg-slate-800 p-2.5 space-y-2">
      <p>¿Quieres tomarle una foto para guardarla con el producto?</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => input.current?.click()} disabled={state === "saving"}>
          <Camera className="h-4 w-4 mr-1" /> {state === "saving" ? "Guardando…" : "Tomar foto"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setState("skipped")}>Ahora no</Button>
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

function CreateProduct({ a }: { a: Extract<AssistantAction, { kind: "crear_producto" }> }) {
  const [id, setId] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>("/products", {
        name: a.name,
        reference: a.reference ?? "",
        brand: a.brand ?? "",
        category: a.category,
        cost: a.cost,
        price: a.price,
        initialStock: a.stock,
        minStock: a.minStock,
      }),
    onSuccess: (p) => { setId(p.id); toast.success("Producto creado"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card icon={<PackagePlus className="h-4 w-4 text-motor" />} title="Crear producto">
      <p className="muted">{a.name}{a.brand ? ` · ${a.brand}` : ""}{a.reference ? ` · ref ${a.reference}` : ""} · venta ${formatMoney(a.price)} · costo ${formatMoney(a.cost)} · stock {a.stock}</p>
      {!id ? <Button full onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Creando…" : "Crear producto"}</Button> : <PhotoPrompt productId={id} />}
    </Card>
  );
}

function CreateCustomer({ a }: { a: Extract<AssistantAction, { kind: "crear_cliente" }> }) {
  const [done, setDone] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      const c = await api.post<{ id: string }>("/customers", { name: a.name, phone: a.phone ?? "" });
      if (a.vehicle) {
        await api.post("/vehicles", { customerId: c.id, kind: a.vehicle.kind, brand: a.vehicle.brand, model: a.vehicle.model, plate: a.vehicle.plate ?? "" });
      }
    },
    onSuccess: () => { setDone(true); toast.success("Cliente creado"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const v = a.vehicle;
  return (
    <Card icon={<UserPlus className="h-4 w-4 text-motor" />} title="Crear cliente">
      <p className="muted">{a.name}{a.phone ? ` · ${a.phone}` : ""}{v ? ` · ${v.brand} ${v.model}${v.plate ? ` · placa ${v.plate}` : ""}` : ""}</p>
      {done ? <p className="text-ok flex items-center gap-1.5"><Check className="h-4 w-4" /> Cliente creado{v ? " con su vehículo" : ""}.</p> : <Button full onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Creando…" : "Crear cliente"}</Button>}
    </Card>
  );
}

function StockEntry({ a }: { a: Extract<AssistantAction, { kind: "entrada_stock" }> }) {
  const [id, setId] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.post(`/products/${a.productId}/movements`, { type: "entrada", qty: a.qty, unitCost: a.unitCost }),
    onSuccess: () => { setId(a.productId!); toast.success(`Entrada de ${a.qty} registrada`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!a.productId) {
    return (
      <Card icon={<PackagePlus className="h-4 w-4 text-amber" />} title="Entrada de stock">
        <p>No encontré “{a.productName}” en el catálogo. Créalo primero y luego registra la entrada.</p>
      </Card>
    );
  }
  return (
    <Card icon={<PackagePlus className="h-4 w-4 text-motor" />} title="Entrada de stock">
      <p className="muted">{a.productName} · +{a.qty}{a.unitCost ? ` · costo unitario ${formatMoney(a.unitCost)}` : ""}</p>
      {id ? <PhotoPrompt productId={id} /> : <Button full onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Registrando…" : `Registrar entrada de ${a.qty}`}</Button>}
    </Card>
  );
}

function PrintInvoice({ a }: { a: Extract<AssistantAction, { kind: "imprimir_factura" }> }) {
  return (
    <Card icon={<Package className="h-4 w-4 text-motor" />} title={`Factura ${a.number}`}>
      {a.orderId ? (
        <Button full variant="ghost" onClick={() => window.open(apiFileUrl(`/orders/${a.orderId}/pdf`), "_blank")}>
          <ExternalLink className="h-4 w-4 mr-1" /> Abrir factura PDF para imprimir
        </Button>
      ) : (
        <p className="muted">No encontré esa factura en tu taller.</p>
      )}
    </Card>
  );
}

function InventoryList({ a }: { a: Extract<AssistantAction, { kind: "consultar_inventario" }> }) {
  return (
    <Card icon={<Package className="h-4 w-4 text-motor" />} title="Inventario">
      <p className="muted">{a.total} productos activos</p>
      {a.lowStock.length ? (
        <div className="flex flex-wrap gap-1.5">{a.lowStock.map((x) => <Badge key={x.name} tone="bad">{x.name}: {x.stock} (mín {x.minStock})</Badge>)}</div>
      ) : (
        <p className="text-ok">Nada bajo de stock.</p>
      )}
    </Card>
  );
}
