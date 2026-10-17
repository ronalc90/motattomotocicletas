import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Bike, Car, CarFront } from "lucide-react";
import { RegisterTenantSchema, ROLE_LABEL, type Role, type Tenant } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";
import { Button, Input, PageLoader } from "@/components/ui";
import { AuthLayout } from "@/layouts/AuthLayout";
import { cn } from "@/lib/utils";

function AuthFrame({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <AuthLayout>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-10">
        <div className={cn("w-full card bg-white text-ink dark:bg-ink-2 dark:text-slate-100 p-6 sm:p-8 shadow-float", wide ? "max-w-xl" : "max-w-md")}>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {sub && <p className="muted mt-1 text-sm">{sub}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </AuthLayout>
  );
}

const TYPES = [
  { v: "motos", label: "Motos", icon: Bike },
  { v: "carros", label: "Carros", icon: Car },
  { v: "ambos", label: "Ambos", icon: CarFront },
] as const;

export function Registro() {
  const { setSession } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof RegisterTenantSchema>>({
    resolver: zodResolver(RegisterTenantSchema), defaultValues: { type: "motos" },
  });
  const type = watch("type");
  return (
    <AuthFrame title="Registrar mi taller" sub="Dos minutos. Sin tarjeta." wide>
      <form className="space-y-4" onSubmit={handleSubmit(async (v) => {
        try {
          const r = await api.post<{ token: string; user: AuthUser; tenant: Tenant }>("/auth/register", v);
          await setSession(r.token, r.user, r.tenant);
          toast.success(`¡Bienvenido, ${r.user.name.split(" ")[0]}!`);
          nav("/app/bienvenida", { replace: true });
        } catch (e) { toast.error(errorMessage(e)); }
      })}>
        <Input label="Nombre del taller" placeholder="Ej. Motatto Motocicletas" required {...register("tenantName")} error={errors.tenantName?.message} />
        <div>
          <span className="mb-1.5 block text-sm font-medium">Tipo de taller</span>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button type="button" key={t.v} onClick={() => setValue("type", t.v)} className={cn("flex flex-col items-center gap-1.5 rounded-btn border-2 py-3 text-sm font-medium transition-colors", type === t.v ? "border-motor bg-motor-soft text-motor-dark dark:bg-motor/20 dark:text-orange-300" : "line hover:bg-slate-50 dark:hover:bg-slate-800")}>
                <t.icon className="h-6 w-6" />{t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Ciudad" placeholder="Bogotá" {...register("city")} error={errors.city?.message} />
          <Input label="WhatsApp del taller" placeholder="321 422 9804" inputMode="tel" {...register("phone", { setValueAs: (v: string) => (v?.trim() ? v : undefined) })} error={errors.phone?.message} />
        </div>
        <hr className="line" />
        <Input label="Tu nombre" required {...register("ownerName")} error={errors.ownerName?.message} />
        <Input label="Correo" type="email" autoComplete="email" required {...register("email")} error={errors.email?.message} />
        <Input label="Contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres" required {...register("password")} error={errors.password?.message} />
        <Button type="submit" full size="lg" loading={isSubmitting}>Crear mi taller</Button>
      </form>
      <p className="mt-6 text-sm text-center muted">¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-motor-dark">Ingresar</Link></p>
    </AuthFrame>
  );
}

export function Invitacion() {
  const { token = "" } = useParams();
  const { setSession } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ name: string; email: string; role: Role; tenantName: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const schema = z.object({ password: z.string().min(8, "Mínimo 8 caracteres"), confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    api.get<typeof info>(`/auth/invite/${token}`).then(setInfo).catch((e) => setErr(errorMessage(e)));
  }, [token]);
  return (
    <AuthFrame title="Te invitaron a un taller" sub={info ? `${info.tenantName} te invitó como ${ROLE_LABEL[info.role].toLowerCase()}.` : undefined}>
      {err ? (
        <div className="text-sm"><p className="text-bad font-medium">{err}</p><p className="muted mt-2">Pídele al dueño del taller que te envíe una invitación nueva.</p></div>
      ) : !info ? <PageLoader /> : (
        <form className="space-y-4" onSubmit={handleSubmit(async (v) => {
          try {
            const r = await api.post<{ token: string; user: AuthUser; tenant: Tenant }>("/auth/invite/accept", { token, password: v.password });
            await setSession(r.token, r.user, r.tenant);
            toast.success("Cuenta activada");
            nav("/app", { replace: true });
          } catch (e) { toast.error(errorMessage(e)); }
        })}>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm"><div className="font-semibold">{info.name}</div><div className="muted">{info.email}</div></div>
          <Input label="Crea tu contraseña" type="password" autoComplete="new-password" {...register("password")} error={errors.password?.message} />
          <Input label="Repite la contraseña" type="password" autoComplete="new-password" {...register("confirm")} error={errors.confirm?.message} />
          <Button type="submit" full size="lg" loading={isSubmitting}>Activar mi cuenta</Button>
        </form>
      )}
    </AuthFrame>
  );
}
