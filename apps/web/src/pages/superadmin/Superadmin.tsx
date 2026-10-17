import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, ChevronLeft, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type Paginated, type Tenant, type User } from "@motatto/shared";
import { api, errorMessage, tokenStore } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge, Button, Card, CardTitle, ConfirmDialog, DataTable, EmptyState, Input, Modal, PageHeader, PageLoader, PlanBadge, SearchBox, Select, Stat, TenantStatusBadge } from "@/components/ui";
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
            <div>
              <p className="text-sm font-medium mb-1">Límite mensual de IA (llamadas)</p>
              <AiLimitEditor tenantId={t.id} limit={t.aiCallsLimit} />
            </div>
            <p className="text-xs muted">Suspendido: los usuarios solo pueden entrar y ver, no operar. Al llegar al límite de IA, el asistente sigue funcionando sin IA.</p>
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
      <PurgeCard tenantId={t.id} name={t.name} slug={t.slug} />
      <ConfirmDialog open={impOpen} onClose={() => setImpOpen(false)} onConfirm={() => imp.mutate()} loading={imp.isPending} title={`¿Entrar a ${t.name} como soporte?`} message="Verás el taller como su dueño durante 4 horas. La acción queda registrada en la auditoría del taller." confirmText="Entrar" />
    </div>
  );
}

/** Elimina el taller con todos sus datos. Irreversible: exige escribir el slug exacto. */
export function PurgeCard({ tenantId, name, slug }: { tenantId: string; name: string; slug: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => api.delete<{ deleted: boolean; counts: Record<string, number> }>(`/superadmin/tenants/${tenantId}`, { confirm: typed }),
    onSuccess: () => {
      toast.success(`Taller "${name}" eliminado`);
      qc.invalidateQueries({ queryKey: ["sa-tenants"] });
      qc.invalidateQueries({ queryKey: ["sa-users"] });
      nav("/superadmin/talleres", { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card className="border-bad/40">
      <CardTitle>Zona de peligro</CardTitle>
      <p className="text-sm muted mb-3">Eliminar el taller borra para siempre sus usuarios, clientes, vehículos, productos, órdenes, pagos, caja y facturas. No se puede deshacer. Si solo quieres cortarle el acceso, suspéndelo arriba.</p>
      <Button variant="danger" onClick={() => { setTyped(""); setOpen(true); }}>Eliminar taller</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Eliminar ${name}`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="danger" onClick={() => del.mutate()} loading={del.isPending} disabled={typed !== slug}>Eliminar para siempre</Button>
        </>}>
        <div className="space-y-3">
          <p className="text-sm">Para confirmar, escribe el slug del taller: <code className="font-mono font-semibold">{slug}</code></p>
          <Input label="Slug del taller" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    </Card>
  );
}

interface AiUsageRow { tenantId: string; name: string; slug: string; plan: Tenant["plan"]; status: Tenant["status"]; limit: number; calls: number; pct: number; promptTokens: number; completionTokens: number; transcriptions: number; costUsd: number }
interface AiUsageResp { month: string; totals: { calls: number; promptTokens: number; completionTokens: number; transcriptions: number; costUsd: number; tenantsOverLimit: number; tenantsActive: number }; items: AiUsageRow[] }

/** Edita el límite mensual de llamadas de IA de un taller. Solo el superadmin lo ve. */
export function AiLimitEditor({ tenantId, limit }: { tenantId: string; limit: number }) {
  const qc = useQueryClient();
  const [v, setV] = useState(String(limit));
  useEffect(() => setV(String(limit)), [limit]);
  const n = Number(v);
  const valid = v !== "" && Number.isInteger(n) && n >= 0 && n <= 1000000;
  const save = useMutation({
    mutationFn: () => api.patch(`/superadmin/tenants/${tenantId}`, { aiCallsLimit: n }),
    onSuccess: () => {
      toast.success("Límite de IA guardado");
      qc.invalidateQueries({ queryKey: ["sa-ai-usage"] });
      qc.invalidateQueries({ queryKey: ["sa-tenant", tenantId] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={0} className="field h-9 w-28 py-1 tabular-nums" value={v} onChange={(e) => setV(e.target.value)} aria-label="Límite mensual de IA" />
      <Button size="sm" onClick={() => save.mutate()} disabled={!valid || save.isPending || n === limit}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
    </div>
  );
}

function currentMonthInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Métricas de uso de IA de todos los talleres, con límite editable. */
export function SaAi() {
  const [month, setMonth] = useState(currentMonthInput());
  const q = useQuery({ queryKey: ["sa-ai-usage", month], queryFn: () => api.get<AiUsageResp>("/superadmin/ai-usage", { month }) });
  if (q.isLoading || !q.data) return <PageLoader />;
  const { totals, items } = q.data;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Uso de IA"
        sub="Llamadas, tokens y costo estimado por taller. Cambia el límite de cada taller en la última columna."
        action={<input type="month" className="field h-10 w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes" />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Llamadas del mes" value={totals.calls} tone="motor" />
        <Stat label="Costo estimado" value={`US$ ${totals.costUsd.toFixed(2)}`} sub={`${totals.transcriptions} transcripciones de voz`} />
        <Stat label="Talleres que usan IA" value={totals.tenantsActive} />
        <Stat label="Talleres en su límite" value={totals.tenantsOverLimit} sub="ya no usan IA este mes" />
      </div>
      <DataTable
        rows={items}
        rowKey={(t) => t.tenantId}
        empty={<EmptyState icon={<Building2 />} title="Sin talleres" />}
        columns={[
          { key: "name", header: "Taller", cell: (t) => <span><span className="font-medium">{t.name}</span><span className="block text-xs muted">{t.slug}</span></span> },
          { key: "plan", header: "Plan", cell: (t) => <PlanBadge plan={t.plan} />, hideMobile: true },
          {
            key: "usage",
            header: "Uso del mes",
            cell: (t) => (
              <div className="min-w-[150px]">
                <div className="text-xs tabular-nums">{t.calls} / {t.limit} · {t.pct}%</div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1 overflow-hidden">
                  <div className={cn("h-full", t.pct >= 100 ? "bg-bad" : t.pct >= 80 ? "bg-amber" : "bg-motor")} style={{ width: `${Math.min(100, t.pct)}%` }} />
                </div>
              </div>
            ),
          },
          { key: "tokens", header: "Tokens", cell: (t) => (t.promptTokens + t.completionTokens).toLocaleString("es-CO"), hideMobile: true },
          { key: "cost", header: "Costo US$", cell: (t) => t.costUsd.toFixed(3), hideMobile: true },
          { key: "voice", header: "Voz", cell: (t) => t.transcriptions, hideMobile: true },
          { key: "limit", header: "Límite / mes", cell: (t) => <AiLimitEditor tenantId={t.tenantId} limit={t.limit} /> },
        ]}
      />
      <p className="text-xs muted">Costo estimado con precios públicos de gpt-4o-mini y whisper-1; la factura real de OpenAI manda.</p>
    </div>
  );
}
