import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CustomerSchema, VEHICLE_BRANDS_CARRO, VEHICLE_BRANDS_MOTO, VehicleSchema, type Customer, type CustomerInput, type Vehicle, type VehicleInput } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";

export function CustomerModal({ open, onClose, onSaved, initial }: { open: boolean; onClose: () => void; onSaved: (c: Customer) => void; initial?: Customer }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerInput>({
    resolver: zodResolver(CustomerSchema),
    values: initial ? { name: initial.name, phone: initial.phone ?? "", document: initial.document ?? "", notes: initial.notes ?? "" } : undefined,
  });
  return (
    <Modal open={open} onClose={onClose} title={initial ? "Editar cliente" : "Nuevo cliente"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="customer-form" type="submit" loading={isSubmitting}>Guardar</Button></>}>
      <form id="customer-form" className="space-y-3" onSubmit={handleSubmit(async (v) => {
        try {
          const c = initial ? await api.patch<Customer>(`/customers/${initial.id}`, v) : await api.post<Customer>("/customers", v);
          toast.success(initial ? "Cliente actualizado" : "Cliente creado");
          onSaved(c);
        } catch (e) { toast.error(errorMessage(e)); }
      })}>
        <Input label="Nombre" required autoFocus {...register("name")} error={errors.name?.message} />
        <Input label="WhatsApp" inputMode="tel" placeholder="3xx xxx xxxx" {...register("phone")} error={errors.phone?.message} />
        <Input label="Documento" {...register("document")} error={errors.document?.message} />
        <Textarea label="Notas" rows={2} {...register("notes")} error={errors.notes?.message} />
      </form>
    </Modal>
  );
}

export function VehicleModal({ open, onClose, onSaved, customerId, initial }: { open: boolean; onClose: () => void; onSaved: (v: Vehicle) => void; customerId: string; initial?: Vehicle }) {
  const { tenant } = useAuth();
  const defaultKind = tenant?.type === "carros" ? "carro" : "moto";
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<VehicleInput>({
    resolver: zodResolver(VehicleSchema),
    values: initial
      ? { customerId, kind: initial.kind, brand: initial.brand, model: initial.model, plate: initial.plate ?? "", year: initial.year, color: initial.color ?? "", lastKm: initial.lastKm }
      : { customerId, kind: defaultKind, brand: "", model: "", plate: "", color: "" },
  });
  const kind = watch("kind");
  const brands = kind === "carro" ? VEHICLE_BRANDS_CARRO : VEHICLE_BRANDS_MOTO;
  return (
    <Modal open={open} onClose={onClose} title={initial ? "Editar vehículo" : "Nuevo vehículo"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button form="vehicle-form" type="submit" loading={isSubmitting}>Guardar</Button></>}>
      <form id="vehicle-form" className="space-y-3" onSubmit={handleSubmit(async (v) => {
        try {
          const body = { ...v, year: v.year || undefined, lastKm: v.lastKm || undefined };
          const r = initial ? await api.patch<Vehicle>(`/vehicles/${initial.id}`, body) : await api.post<Vehicle>("/vehicles", body);
          toast.success(initial ? "Vehículo actualizado" : "Vehículo creado");
          onSaved(r);
        } catch (e) { toast.error(errorMessage(e)); }
      })}>
        <input type="hidden" {...register("customerId")} />
        {tenant?.type === "ambos" && <Select label="Tipo" options={[{ value: "moto", label: "Moto" }, { value: "carro", label: "Carro" }]} {...register("kind")} />}
        {tenant?.type !== "ambos" && <input type="hidden" {...register("kind")} />}
        <Input label="Placa" placeholder="ABC123" className="uppercase font-display tracking-widest" autoFocus {...register("plate", { setValueAs: (v: string) => v.toUpperCase().replace(/\s+/g, "") })} error={errors.plate?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Marca" required list="brands" {...register("brand")} error={errors.brand?.message} />
          <datalist id="brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          <Input label="Modelo" required placeholder="NS 200" {...register("model")} error={errors.model?.message} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Año" inputMode="numeric" {...register("year", { setValueAs: (v: string) => (v ? Number(v) : undefined) })} error={errors.year?.message} />
          <Input label="Color" {...register("color")} />
          <Input label="Km" inputMode="numeric" {...register("lastKm", { setValueAs: (v: string) => (v ? Number(v) : undefined) })} error={errors.lastKm?.message} />
        </div>
      </form>
    </Modal>
  );
}
