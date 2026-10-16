import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2, Wrench } from "lucide-react";
import { formatMoney, type Service } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { fetchers, qk } from "@/lib/queries";
import { Button, Card, ConfirmDialog, EmptyState, Input, Modal, MoneyInput, PageHeader, PageLoader } from "@/components/ui";

export function Services() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.services, queryFn: fetchers.services });
  const [create, setCreate] = useState(false);
  const [del, setDel] = useState<Service | null>(null);
  const groups = useMemo(() => (list.data?.items ?? []).reduce<Record<string, Service[]>>((a, s) => ((a[s.category] ??= []).push(s), a), {}), [list.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.services });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/services/${id}`), onSuccess: () => { toast.success("Servicio eliminado"); setDel(null); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Servicios" sub="Mano de obra con precio sugerido. El precio se puede cambiar en cada orden." action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreate(true)}>Nuevo</Button>} />
      {list.isLoading ? <PageLoader /> : !list.data?.items.length ? <EmptyState icon={<Wrench />} title="Sin servicios" action={<Button onClick={() => setCreate(true)}>Crear servicio</Button>} /> : (
        <div className="space-y-4">
          {Object.entries(groups).map(([cat, items]) => (
            <Card key={cat} className="p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 font-semibold text-sm">{cat}</div>
              <ul className="divide-y line">{items.map((s) => <ServiceRow key={s.id} s={s} onChanged={refresh} onDelete={() => setDel(s)} />)}</ul>
            </Card>
          ))}
        </div>
      )}
      <ServiceModal open={create} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); refresh(); }} categories={Object.keys(groups)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} danger title={`¿Eliminar “${del?.name}”?`} message="Deja de aparecer en el catálogo. Las órdenes anteriores no cambian." confirmText="Eliminar" />
    </div>
  );
}

function ServiceRow({ s, onChanged, onDelete }: { s: Service; onChanged: () => void; onDelete: () => void }) {
  const [price, setPrice] = useState(s.suggestedPrice);
  const [editing, setEditing] = useState(false);
  const m = useMutation({ mutationFn: () => api.patch(`/services/${s.id}`, { suggestedPrice: price }), onSuccess: () => { toast.success("Precio actualizado"); setEditing(false); onChanged(); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <li className="px-4 py-2 flex items-center gap-3">
      <span className="flex-1 text-sm">{s.name}</span>
      {editing ? (
        <div className="flex items-center gap-1.5"><div className="w-32"><MoneyInput value={price} onChange={setPrice} className="h-9 py-1" autoFocus /></div><Button size="sm" onClick={() => m.mutate()} loading={m.isPending} icon={<Check className="h-4 w-4" />} aria-label="Guardar" /></div>
      ) : (
        <button onClick={() => setEditing(true)} className="font-semibold tabular-nums text-sm rounded-md px-2 py-1 hover:bg-motor-soft dark:hover:bg-motor/20" title="Editar precio">$ {formatMoney(s.suggestedPrice)}</button>
      )}
      <button onClick={onDelete} className="muted hover:text-bad p-1" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}

function ServiceModal({ open, onClose, onSaved, categories }: { open: boolean; onClose: () => void; onSaved: () => void; categories: string[] }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [price, setPrice] = useState(0);
  const m = useMutation({ mutationFn: () => api.post("/services", { name, category, suggestedPrice: price }), onSuccess: () => { toast.success("Servicio creado"); setName(""); setPrice(0); onSaved(); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Modal open={open} onClose={onClose} title="Nuevo servicio" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => m.mutate()} loading={m.isPending} disabled={name.trim().length < 2}>Crear</Button></>}>
      <Input label="Nombre" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Cambio de cunas de dirección" />
      <Input label="Categoría" list="svc-cats" value={category} onChange={(e) => setCategory(e.target.value)} wrapClass="mt-3" />
      <datalist id="svc-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <MoneyInput label="Precio sugerido" value={price} onChange={setPrice} wrapClass="mt-3" />
    </Modal>
  );
}
