import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, ChevronLeft, LifeBuoy } from "lucide-react";
import { ROLE_LABEL, type Paginated, type Tenant, type User } from "@motatto/shared";
import { api, errorMessage, tokenStore } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge, Button, Card, CardTitle, ConfirmDialog, DataTable, EmptyState, PageHeader, PageLoader, PlanBadge, SearchBox, Select, Stat, TenantStatusBadge } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type SaTenant = Tenant & { usage: { usersCount: number; productsCount: number; ordersThisMonth: number; ordersTotal: number } };

export function SaStats() {
  const q = useQuery({ queryKey: ["sa-stats"], queryFn: () => api.get<{ tenants: number; active: number; ordersTotal: number; ordersThisMonth: number; users: number }>("/superadmin/stats") });
  const recent = useQuery({ queryKey: ["sa-tenants", ""], queryFn: () => api.get<Paginated<SaTenant>>("/superadmin/tenants") });
  if (q.isLoading || !q.data) return <PageLoader />;
  const s = q.data;
  return (
    <div className="space-y-5">
      <PageHeader title="Plataforma" sub="Estado general de Motatto" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Talleres" value={s.tenants} tone="dark" />
        <Stat label="Activos" value={s.active} sub={`${s.tenants - s.active} suspendidos`} />
        <Stat label="Usuarios activos" value={s.users} />
        <Stat label="Órdenes este mes" value={s.ordersThisMonth} tone="motor" />
        <Stat label="Órdenes en total" value={s.ordersTotal} />
      </div>
      <Card>
        <CardTitle action={<Link to="/superadmin/talleres" className="text-sm font-medium text-motor-dark">Ver todos</Link>}>Últimos talleres</CardTitle>
        <ul className="divide-y line -mx-4 sm:-mx-5">{(recent.data?.items ?? []).slice(0, 8).map((t) => <li key={t.id}><Link to={`/superadmin/talleres/${t.id}`} className="px-4 sm:px-5 py-2.5 flex items-center gap-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"><span className="flex-1 min-w-0"><span className="font-medium">{t.name}</span><span className="muted"> · {t.city ?? "—"}</span></span><PlanBadge plan={t.plan} /><TenantStatusBadge status={t.status} /><span className="text-xs muted">{fmtDate(t.createdAt)}</span></Link></li>)}</ul>
      </Card>
    </div>
  );
}

export function SaTenants() {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const nav = useNavigate();
  const list = useQuery({ queryKey: ["sa-tenants", dq], queryFn: () => api.get<Paginated<SaTenant>>("/superadmin/tenants", { q: dq }) });
  return (
    <div>
      <PageHeader title="Talleres" sub={list.data ? `${list.data.total} registrados` : undefined} />
      <SearchBox value={q} onChange={setQ} placeholder="Nombre, slug, correo o ciudad" className="mb-4" />
      {list.isLoading ? <PageLoader /> : (
        <DataTable rows={list.data?.items ?? []} rowKey={(t) => t.id} onRowClick={(t) => nav(`/superadmin/talleres/${t.id}`)} empty={<EmptyState icon={<Building2 />} title="Sin talleres" />}
          columns={[
            { key: "name", header: "Taller", cell: (t) => <span><span className="font-medium">{t.name}</span><span className="block text-xs muted">{t.slug} · {t.email}</span></span> },
            { key: "city", header: "Ciudad", cell: (t) => t.city ?? "—", hideMobile: true },
            { key: "type", header: "Tipo", cell: (t) => <Badge>{t.type}</Badge> },
            { key: "plan", header: "Plan", cell: (t) => <PlanBadge plan={t.plan} /> },
            { key: "status", header: "Estado", cell: (t) => <TenantStatusBadge status={t.status} /> },
            { key: "usage", header: "Uso", cell: (t) => <span className="text-xs tabular-nums">{t.usage.ordersThisMonth} órd/mes · {t.usage.usersCount} usr · {t.usage.productsCount} prod</span> },
            { key: "created", header: "Creado", cell: (t) => fmtDate(t.createdAt), hideMobile: true },
          ]} />
      )}
    </div>
  );
}

export function SaTenantDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { setSession } = useAuth();
  const q = useQuery({ queryKey: ["sa-tenant", id], queryFn: () => api.get<SaTenant & { users: User[] }>(`/superadmin/tenants/${id}`) });
  const [impOpen, setImpOpen] = useState(false);
  const upd = useMutation({ mutationFn: (body: Record<string, string>) => api.patch(`/superadmin/tenants/${id}`, body), onSuccess: () => { toast.success("Taller actualizado"); qc.invalidateQueries({ queryKey: ["sa-tenant", id] }); qc.invalidateQueries({ queryKey: ["sa-tenants"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  const imp = useMutation({
    mutationFn: () => api.post<{ token: string }>(`/superadmin/tenants/${id}/impersonate`),
    onSuccess: async (r) => { const original = tokenStore.get(); if (original) tokenStore.setSupport(original); await setSession(r.token); toast.success("Modo soporte activo"); nav("/app"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading) return <PageLoader />;
  const t = q.data;
  if (!t) return <EmptyState title="Taller no encontrado" />;
  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader title={t.name} back={<Link to="/superadmin/talleres" className="inline-flex items-center gap-1 text-sm muted mb-1"><ChevronLeft className="h-4 w-4" /> Talleres</Link>}
        sub={<span className="inline-flex items-center gap-2 flex-wrap">{t.slug} · {t.email}{t.city && ` · ${t.city}`}<PlanBadge plan={t.plan} /><TenantStatusBadge status={t.status} /></span>}
        action={<Button variant="dark" icon={<LifeBuoy className="h-4 w-4" />} onClick={() => setImpOpen(true)}>Entrar como soporte</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Órdenes este mes" value={t.usage.ordersThisMonth} tone="motor" />
        <Stat label="Órdenes en total" value={t.usage.ordersTotal} />
        <Stat label="Usuarios" value={t.usage.usersCount} />
        <Stat label="Productos" value={t.usage.productsCount} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Plan y estado</CardTitle>
          <div className="space-y-3">
            <Select label="Plan" options={[{ value: "gratis", label: "Gratis" }, { value: "pro", label: "Pro" }]} value={t.plan} onChange={(e) => upd.mutate({ plan: e.target.value })} />
            <Select label="Estado" options={[{ value: "activo", label: "Activo" }, { value: "suspendido", label: "Suspendido" }]} value={t.status} onChange={(e) => upd.mutate({ status: e.target.value })} />
            <p className="text-xs muted">Suspendido: los usuarios solo pueden entrar y ver, no operar.</p>
          </div>
        </Card>
        <Card>
          <CardTitle>Información</CardTitle>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="muted">Tipo</dt><dd>{t.type}</dd>
            <dt className="muted">Teléfono</dt><dd>{t.phone ?? "—"}</dd>
            <dt className="muted">Dirección</dt><dd>{t.address ?? "—"}</dd>
            <dt className="muted">Prefijo</dt><dd>{t.settings.invoicePrefix}</dd>
            <dt className="muted">Creado</dt><dd>{fmtDateTime(t.createdAt)}</dd>
          </dl>
        </Card>
      </div>
      <Card>
        <CardTitle>Usuarios</CardTitle>
        <ul className="divide-y line -mx-4 sm:-mx-5 text-sm">{t.users.map((u) => <li key={u.id} className="px-4 sm:px-5 py-2 flex items-center gap-3"><span className="flex-1 min-w-0"><span className="font-medium">{u.name}</span><span className="block text-xs muted">{u.email}</span></span><Badge>{ROLE_LABEL[u.role]}</Badge>{!u.active && <Badge tone="amber">inactivo</Badge>}<span className="text-xs muted">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "nunca"}</span></li>)}</ul>
      </Card>
      <ConfirmDialog open={impOpen} onClose={() => setImpOpen(false)} onConfirm={() => imp.mutate()} loading={imp.isPending} title={`¿Entrar a ${t.name} como soporte?`} message="Verás el taller como su dueño durante 4 horas. La acción queda registrada en la auditoría del taller." confirmText="Entrar" />
    </div>
  );
}
