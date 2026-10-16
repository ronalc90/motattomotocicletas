import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABEL, ProductSchema, type Product, type ProductInput } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { useCan } from "@/hooks/useCan";
import { Button, Input, Modal, MoneyInput, Select } from "@/components/ui";

export interface ProductFormDefaults extends Partial<ProductInput> {}

export function ProductModal({ open, onClose, onSaved, initial, defaults, title }: { open: boolean; onClose: () => void; onSaved: (p: Product) => void; initial?: Product; defaults?: ProductFormDefaults; title?: string }) {
  const can = useCan();
  const manage = can("inventory:manage");
  const showCost = can("inventory:cost");
  const base: ProductInput = {
    name: "", reference: "", barcode: "", brand: "", category: "otro", compatibleWith: [], cost: 0, price: 0, minStock: 1, location: "", active: true, initialStock: 0, ...defaults,
  };
  const values: ProductInput = initial
    ? { name: initial.name, reference: initial.reference ?? "", barcode: initial.barcode ?? "", brand: initial.brand ?? "", category: initial.category, compatibleWith: initial.compatibleWith, cost: initial.cost ?? 0, price: initial.price, minStock: initial.minStock, location: initial.location ?? "", active: initial.active }
    : base;
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<ProductInput>({ resolver: zodResolver(ProductSchema), values });
  const [compat, setCompat] = useState("");
  const compatibleWith = watch("compatibleWith") ?? [];
  const cost = watch("cost") ?? 0;
  const price = watch("price") ?? 0;
  const initialStock = watch("initialStock") ?? 0;
  const addCompat = () => { const v = compat.trim(); if (v && !compatibleWith.includes(v)) setValue("compatibleWith", [...compatibleWith, v]); setCompat(""); };

  return (
    <Modal open={open} onClose={onClose} title={title ?? (initial ? "Editar producto" : "Nuevo producto")}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="product-form" type="submit" loading={isSubmitting}>{initial ? "Guardar" : "Crear producto"}</Button></>}>
      <form id="product-form" className="space-y-3" onSubmit={handleSubmit(async (v) => {
        try {
          const body = { ...v, initialStock: initial ? undefined : v.initialStock };
          const p = initial ? await api.patch<Product>(`/products/${initial.id}`, body) : await api.post<Product>("/products", body);
          toast.success(initial ? "Producto actualizado" : "Producto creado");
          onSaved(p);
        } catch (e) { toast.error(errorMessage(e)); }
      })}>
        <Input label="Nombre" required autoFocus placeholder="Bujía central NS 200" {...register("name")} error={errors.name?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Referencia" placeholder="JG351209" {...register("reference")} error={errors.reference?.message} />
          <Input label="Código de barras" {...register("barcode")} error={errors.barcode?.message} />
          <Input label="Marca" placeholder="Bajaj" {...register("brand")} error={errors.brand?.message} />
          <Select label="Categoría" options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: PRODUCT_CATEGORY_LABEL[c] }))} {...register("category")} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Compatible con</span>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {compatibleWith.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium">{c}<button type="button" onClick={() => setValue("compatibleWith", compatibleWith.filter((x) => x !== c))} aria-label="Quitar"><X className="h-3 w-3" /></button></span>)}
          </div>
          <div className="flex gap-2"><input className="field" placeholder="NS 200, Pulsar 180…" value={compat} onChange={(e) => setCompat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCompat(); } }} /><Button type="button" variant="secondary" onClick={addCompat}>Agregar</Button></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {showCost && <MoneyInput label="Costo de compra" value={cost} onChange={(n) => setValue("cost", n)} disabled={!!initial && !manage} />}
          <MoneyInput label="Precio de venta" value={price} onChange={(n) => setValue("price", n)} disabled={!!initial && !manage} error={errors.price?.message} />
          {!initial && <Input label="Stock inicial" inputMode="numeric" type="number" min={0} value={initialStock} onChange={(e) => setValue("initialStock", Number(e.target.value) || 0)} />}
          <Input label="Stock mínimo" inputMode="numeric" type="number" min={0} {...register("minStock")} error={errors.minStock?.message} />
          <Input label="Ubicación" placeholder="Estante B2" {...register("location")} wrapClass={initial ? "col-span-2" : ""} />
        </div>
      </form>
    </Modal>
  );
}
