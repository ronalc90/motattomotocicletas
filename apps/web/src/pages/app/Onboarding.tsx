import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Camera, Check, Copy, MessageCircle, Upload, UserPlus } from "lucide-react";
import { ROLE_LABEL, type Tenant } from "@motatto/shared";
import { api, assetUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { ProductModal } from "@/components/inventory/ProductForm";
import { copyText } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STEPS = ["Datos para la cuenta", "Primer repuesto", "Invita a tu equipo"];

export function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const finish = () => nav("/app", { replace: true });
  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tu taller ya existe. Afinemos tres cosas.</h1>
        <p className="muted text-sm mt-1">Todo se puede saltar y cambiar después en Configuración.</p>
        <ol className="mt-4 flex gap-2">
          {STEPS.map((s, i) => <li key={s} className={cn("flex-1 text-xs font-medium border-t-4 pt-2", i < step ? "border-ok text-ok" : i === step ? "border-motor" : "border-slate-200 dark:border-slate-700 muted")}>{i + 1}. {s}</li>)}
        </ol>
      </div>
      {step === 0 && <StepInvoice onNext={() => setStep(1)} />}
      {step === 1 && <StepProduct onNext={() => setStep(2)} />}
      {step === 2 && <StepInvite onNext={finish} />}
    </div>
  );
}

function StepInvoice({ onNext }: { onNext: () => void }) {
  const { tenant, setTenant } = useAuth();
  const t = tenant!;
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: { address: t.address ?? "", paymentInfo: t.settings.paymentInfo, pct: t.settings.surcharges.find((s) => s.method === "nequi")?.pct ?? 3, warrantyDays: t.settings.warrantyDays, warrantyText: t.settings.warrantyText } });
  const [uploading, setUploading] = useState(false);
  return (
    <form className="card space-y-4" onSubmit={handleSubmit(async (v) => {
      try {
        const r = await api.patch<Tenant>("/tenant", { address: v.address, settings: { address: v.address, paymentInfo: v.paymentInfo, warrantyDays: Number(v.warrantyDays), warrantyText: v.warrantyText, surcharges: [{ method: "nequi", pct: Number(v.pct) || 0 }] } });
        setTenant(r); toast.success("Datos guardados"); onNext();
      } catch (e) { toast.error(errorMessage(e)); }
    })}>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl border line bg-white flex items-center justify-center overflow-hidden">{t.settings.logoUrl ? <img src={assetUrl(t.settings.logoUrl)} alt="" className="h-full w-full object-contain" /> : <Upload className="h-5 w-5 muted" />}</div>
        <label className="inline-flex items-center gap-2 rounded-btn border line px-3 h-11 text-sm font-semibold cursor-pointer">{uploading ? "Subiendo…" : "Subir logo"}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { setTenant(await api.upload<Tenant>("/tenant/logo", f)); } catch (er) { toast.error(errorMessage(er)); } finally { setUploading(false); } }} /></label>
      </div>
      <Input label="Dirección del taller" {...register("address")} />
      <Input label="Datos para transferencias" placeholder="Nequi 321 422 9804" {...register("paymentInfo")} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Recargo Nequi (%)" type="number" min={0} max={100} step={0.5} {...register("pct")} />
        <Input label="Días de garantía" type="number" min={0} {...register("warrantyDays")} />
      </div>
      <Textarea label="Texto de garantía" rows={4} {...register("warrantyText")} />
      <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onNext}>Saltar</Button><Button type="submit" className="flex-1" loading={isSubmitting}>Guardar y seguir</Button></div>
    </form>
  );
}

function StepProduct({ onNext }: { onNext: () => void }) {
  const nav = useNavigate();
  const [manual, setManual] = useState(false);
  return (
    <div className="card space-y-4">
      <p className="text-sm">Toma la foto de la etiqueta de un repuesto y mira cómo el sistema lo lee. O créalo a mano.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" icon={<Camera className="h-5 w-5" />} onClick={() => nav("/app/inventario/entrada")}>Entrada por foto</Button>
        <Button size="lg" variant="secondary" onClick={() => setManual(true)}>Crear a mano</Button>
      </div>
      <Button variant="ghost" full onClick={onNext}>Saltar por ahora</Button>
      <ProductModal open={manual} onClose={() => setManual(false)} onSaved={() => { setManual(false); onNext(); }} />
    </div>
  );
}

function StepInvite({ onNext }: { onNext: () => void }) {
  const { tenant } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("mecanico");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card space-y-4">
      {url ? (
        <>
          <div className="flex items-center gap-2 text-ok font-medium"><Check className="h-5 w-5" /> Invitación creada</div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs break-all font-mono">{url}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copyText(url).then(() => toast.success("Copiado"))}>Copiar</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Te invito a ${tenant?.name} en Motatto: ${url}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-btn bg-ok text-white h-11 font-semibold text-[15px]"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          </div>
          <Button full size="lg" onClick={onNext}>Ir a mi panel</Button>
        </>
      ) : (
        <>
          <p className="text-sm">Invita a tu mecánico o a quien cobra. Recibe un link y crea su contraseña.</p>
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value)} options={(["mecanico", "cajero", "admin", "contador"] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
          <div className="flex gap-2"><Button variant="ghost" onClick={onNext}>Saltar</Button><Button className="flex-1" icon={<UserPlus className="h-4 w-4" />} loading={busy} disabled={!name || !email} onClick={async () => { setBusy(true); try { const r = await api.post<{ inviteUrl: string }>("/users/invite", { name, email, role }); setUrl(r.inviteUrl); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } }}>Crear invitación</Button></div>
        </>
      )}
    </div>
  );
}
