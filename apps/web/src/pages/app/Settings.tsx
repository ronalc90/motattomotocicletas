import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, MessageCircle, Plus, Trash2, Upload, UserPlus } from "lucide-react";
import { ChangePasswordSchema, DEFAULT_FOOTER_TEXT, DEFAULT_WARRANTY_TEXT, InviteUserSchema, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, ROLE_DESCRIPTION, ROLE_LABEL, TENANT_ROLES, UpdateTenantSchema, type AuditEntry, type InviteUserInput, type Paginated, type Role, type Tenant, type UpdateTenantInput, type User } from "@motatto/shared";
import { api, assetUrl, errorMessage } from "@/lib/api";
import { qk } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/hooks/useCan";
import { Avatar, Badge, Button, Card, CardTitle, ConfirmDialog, Input, Modal, PageHeader, PageLoader, PlanBadge, RoleBadge, Select, Tabs, Textarea, Toggle } from "@/components/ui";
import { copyText, fmtDateTime } from "@/lib/utils";

type Tab = "taller" | "usuarios" | "auditoria" | "cuenta";

export function Settings() {
  const [sp, setSp] = useSearchParams();
  const can = useCan();
  const tab = ((sp.get("tab") as Tab) || (can("tenant:settings") ? "taller" : "cuenta"));
  const items: Array<{ value: Tab; label: string }> = [];
  if (can("tenant:settings")) items.push({ value: "taller", label: "Taller" });
  if (can("users:manage")) items.push({ value: "usuarios", label: "Usuarios" });
  if (can("tenant:settings")) items.push({ value: "auditoria", label: "Auditoría" });
  items.push({ value: "cuenta", label: "Mi cuenta" });
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Configuración" />
      <Tabs value={tab} onChange={(v) => setSp({ tab: v })} items={items} className="mb-5" />
      {tab === "taller" && <TenantTab />}
      {tab === "usuarios" && <UsersTab />}
      {tab === "auditoria" && <AuditTab />}
      {tab === "cuenta" && <AccountTab />}
    </div>
  );
}

function TenantTab() {
  const { tenant, setTenant } = useAuth();
  const t = tenant!;
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<UpdateTenantInput>({
    resolver: zodResolver(UpdateTenantSchema),
    defaultValues: {
      name: t.name, type: t.type, city: t.city ?? "", phone: t.phone ?? "", address: t.address ?? "",
      settings: { slogan: t.settings.slogan ?? "", address: t.settings.address ?? "", phone: t.settings.phone ?? "", paymentInfo: t.settings.paymentInfo, surcharges: t.settings.surcharges, warrantyDays: t.settings.warrantyDays, warrantyText: t.settings.warrantyText, footerText: t.settings.footerText, invoicePrefix: t.settings.invoicePrefix, askStockOnClose: t.settings.askStockOnClose, invoiceYearReset: t.settings.invoiceYearReset },
    },
  });
  const surcharges = watch("settings.surcharges") ?? [];
  const askStock = watch("settings.askStockOnClose") ?? true;
  const yearReset = watch("settings.invoiceYearReset") ?? true;
  const [uploading, setUploading] = useState(false);
  async function uploadLogo(f: File) { setUploading(true); try { const r = await api.upload<Tenant>("/tenant/logo", f); setTenant(r); toast.success("Logo actualizado"); } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); } }
  return (
    <form className="space-y-4" onSubmit={handleSubmit(async (v) => {
      try { const r = await api.patch<Tenant>("/tenant", { ...v, phone: v.phone || undefined }); setTenant(r); toast.success("Taller actualizado"); } catch (e) { toast.error(errorMessage(e)); }
    })}>
      <Card>
        <CardTitle action={<span className="inline-flex items-center gap-2"><PlanBadge plan={t.plan} /><span className="text-xs muted">{t.usage?.ordersThisMonth ?? 0} órdenes este mes</span></span>}>Datos del taller</CardTitle>
        <div className="flex items-center gap-4 mb-4">
          <div className="h-20 w-20 rounded-2xl border line bg-white flex items-center justify-center overflow-hidden">{t.settings.logoUrl ? <img src={assetUrl(t.settings.logoUrl)} alt="Logo" className="h-full w-full object-contain" /> : <span className="text-xs muted">Sin logo</span>}</div>
          <label className="inline-flex items-center gap-2 rounded-btn border line px-3 h-11 text-sm font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"><Upload className="h-4 w-4" /> {uploading ? "Subiendo…" : "Subir logo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} /></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Nombre" {...register("name")} error={errors.name?.message} />
          <Select label="Tipo" options={[{ value: "motos", label: "Motos" }, { value: "carros", label: "Carros" }, { value: "ambos", label: "Ambos" }]} {...register("type")} />
          <Input label="Ciudad" {...register("city")} />
          <Input label="WhatsApp del taller" inputMode="tel" {...register("phone")} error={errors.phone?.message} />
          <Input label="Dirección" wrapClass="sm:col-span-2" {...register("address")} />
          <Input label="Eslogan (sale en la cuenta)" wrapClass="sm:col-span-2" placeholder="Tu moto, nuestra pasión" {...register("settings.slogan")} />
        </div>
      </Card>
      <Card>
        <CardTitle>Cuenta de cobro</CardTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Datos de pago" placeholder="Nequi 321 422 9804" wrapClass="sm:col-span-2" {...register("settings.paymentInfo")} />
          <Input label="Prefijo de numeración" placeholder="MT" {...register("settings.invoicePrefix")} error={errors.settings?.invoicePrefix?.message} hint={`Ej. ${t.settings.invoicePrefix}-${new Date().getFullYear()}-0001`} />
          <Input label="Días de garantía" type="number" min={0} max={365} {...register("settings.warrantyDays")} />
          <Textarea label="Texto de garantía" rows={5} wrapClass="sm:col-span-2" {...register("settings.warrantyText")} hint="Una línea por regla." />
          <Textarea label="Pie de la cuenta" rows={2} wrapClass="sm:col-span-2" {...register("settings.footerText")} />
        </div>
        <div className="mt-2 flex gap-3 text-xs"><button type="button" className="muted underline" onClick={() => setValue("settings.warrantyText", DEFAULT_WARRANTY_TEXT)}>Usar garantía por defecto</button><button type="button" className="muted underline" onClick={() => setValue("settings.footerText", DEFAULT_FOOTER_TEXT)}>Usar pie por defecto</button></div>
      </Card>
      <Card>
        <CardTitle action={<Button type="button" size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setValue("settings.surcharges", [...surcharges, { method: "transferencia", pct: 0 }])}>Agregar</Button>}>Recargos por método de pago</CardTitle>
        {surcharges.length === 0 && <p className="text-sm muted">Sin recargos. Agrega uno si cobras un porcentaje por Nequi o transferencia.</p>}
        <div className="space-y-2">
          {surcharges.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} value={s.method} onChange={(e) => setValue("settings.surcharges", surcharges.map((x, j) => (j === i ? { ...x, method: e.target.value as typeof s.method } : x)))} wrapClass="flex-1" />
              <Input type="number" min={0} max={100} step={0.5} value={s.pct} onChange={(e) => setValue("settings.surcharges", surcharges.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) || 0 } : x)))} wrapClass="w-24" prefix="%" />
              <Button type="button" variant="ghost" size="icon" className="text-bad" onClick={() => setValue("settings.surcharges", surcharges.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle>Comportamiento</CardTitle>
        <Toggle label="Preguntar qué descontar del inventario al terminar" hint="Si está apagado, no se descuenta nada automáticamente." checked={askStock} onChange={(v) => setValue("settings.askStockOnClose", v)} />
        <Toggle label="Reiniciar la numeración cada año" checked={yearReset} onChange={(v) => setValue("settings.invoiceYearReset", v)} />
      </Card>
      <div className="sticky bottom-20 lg:bottom-4"><Button type="submit" size="lg" full loading={isSubmitting}>Guardar cambios</Button></div>
    </form>
  );
}

function UsersTab() {
  const { user: me, tenant } = useAuth();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.users, queryFn: () => api.get<Paginated<User>>("/users") });
  const [invite, setInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [del, setDel] = useState<User | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.users });
  const upd = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/users/${id}`, body), onSuccess: () => { toast.success("Usuario actualizado"); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/users/${id}`), onSuccess: () => { toast.success("Usuario eliminado"); setDel(null); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteUserInput>({ resolver: zodResolver(InviteUserSchema), defaultValues: { role: "mecanico" } });
  const roles = TENANT_ROLES.filter((r) => r !== "dueno");
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle action={<Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setInvite(true)}>Invitar</Button>}>Equipo</CardTitle>
        {list.isLoading ? <PageLoader /> : (
          <ul className="divide-y line -mx-4 sm:-mx-5">
            {list.data?.items.map((u) => (
              <li key={u.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <Avatar name={u.name} />
                <span className="flex-1 min-w-0"><span className="flex items-center gap-2 flex-wrap"><span className="font-medium truncate">{u.name}</span><RoleBadge role={u.role} />{!u.active && <Badge tone="amber">{u.lastLoginAt ? "inactivo" : "invitación pendiente"}</Badge>}</span><span className="block text-xs muted truncate">{u.email}{u.lastLoginAt && ` · último ingreso ${fmtDateTime(u.lastLoginAt)}`}</span></span>
                {u.role !== "dueno" && u.id !== me?.id && (
                  <div className="flex items-center gap-1">
                    <select className="field h-9 py-1 text-xs w-auto" value={u.role} onChange={(e) => upd.mutate({ id: u.id, body: { role: e.target.value } })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                    <button className="text-xs muted underline px-1" onClick={() => upd.mutate({ id: u.id, body: { active: !u.active } })}>{u.active ? "desactivar" : "activar"}</button>
                    <button className="muted hover:text-bad p-1" onClick={() => setDel(u)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Roles</CardTitle>
        <ul className="space-y-2 text-sm">{(["dueno", "admin", "mecanico", "cajero", "contador"] as Role[]).map((r) => <li key={r} className="flex gap-3"><RoleBadge role={r} /><span className="muted">{ROLE_DESCRIPTION[r]}</span></li>)}</ul>
      </Card>
      <Modal open={invite} onClose={() => { setInvite(false); setInviteUrl(null); reset(); }} title="Invitar a tu equipo" size="sm"
        footer={!inviteUrl && <><Button variant="secondary" onClick={() => setInvite(false)}>Cancelar</Button><Button form="invite-form" type="submit" loading={isSubmitting}>Crear invitación</Button></>}>
        {inviteUrl ? (
          <div className="space-y-3">
            <p className="text-sm">Comparte este link. Vence en 48 horas.</p>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs break-all font-mono">{inviteUrl}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copyText(inviteUrl).then(() => toast.success("Link copiado"))}>Copiar</Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Te invito a ${tenant?.name} en Motatto. Entra con este link y crea tu contraseña: ${inviteUrl}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-btn bg-ok text-white h-11 font-semibold text-[15px]"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
          </div>
        ) : (
          <form id="invite-form" className="space-y-3" onSubmit={handleSubmit(async (v) => {
            try { const r = await api.post<{ inviteUrl: string }>("/users/invite", v); setInviteUrl(r.inviteUrl); refresh(); } catch (e) { toast.error(errorMessage(e)); }
          })}>
            <Input label="Nombre" autoFocus {...register("name")} error={errors.name?.message} />
            <Input label="Correo" type="email" {...register("email")} error={errors.email?.message} />
            <Select label="Rol" options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} {...register("role")} />
          </form>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} danger title={`¿Quitar a ${del?.name}?`} message="Pierde el acceso al taller. Sus acciones quedan en el historial." confirmText="Quitar" />
    </div>
  );
}

function AuditTab() {
  const q = useQuery({ queryKey: qk.audit, queryFn: () => api.get<Paginated<AuditEntry & { user?: { name: string } }>>("/audit", { limit: 200 }) });
  if (q.isLoading) return <PageLoader />;
  return (
    <Card>
      <CardTitle>Últimas acciones</CardTitle>
      {!q.data?.items.length ? <p className="text-sm muted">Sin registros.</p> : (
        <ul className="divide-y line -mx-4 sm:-mx-5 text-sm">
          {q.data.items.map((a) => (
            <li key={a.id} className="px-4 sm:px-5 py-2 flex items-center gap-3"><span className="font-mono text-xs rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">{a.action}</span><span className="flex-1 min-w-0 truncate">{a.user?.name ?? "—"}<span className="muted"> · {a.entity}</span></span><span className="text-xs muted whitespace-nowrap">{fmtDateTime(a.createdAt)}</span></li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AccountTab() {
  const { user } = useAuth();
  const schema = ChangePasswordSchema.extend({ confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "No coincide" });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => { reset(); }, [reset]);
  return (
    <Card>
      <CardTitle>Mi cuenta</CardTitle>
      <p className="text-sm mb-4">{user?.name} <span className="muted">· {user?.email}</span></p>
      <form className="space-y-3 max-w-sm" onSubmit={handleSubmit(async (v) => {
        try { await api.post("/auth/password", { currentPassword: v.currentPassword, newPassword: v.newPassword }); toast.success("Contraseña cambiada"); reset(); } catch (e) { toast.error(errorMessage(e)); }
      })}>
        <Input label="Contraseña actual" type="password" autoComplete="current-password" {...register("currentPassword")} error={errors.currentPassword?.message} />
        <Input label="Nueva contraseña" type="password" autoComplete="new-password" {...register("newPassword")} error={errors.newPassword?.message} />
        <Input label="Repite la nueva" type="password" autoComplete="new-password" {...register("confirm")} error={errors.confirm?.message} />
        <Button type="submit" loading={isSubmitting}>Cambiar contraseña</Button>
      </form>
    </Card>
  );
}
