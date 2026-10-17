import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { ROLE_LABEL, type Role } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge, Button, Card, CardTitle, DataTable, EmptyState, Input, Modal, PageHeader, PageLoader, SearchBox, Select, Stat } from "@/components/ui";
import { fmtDate, cn } from "@/lib/utils";

interface SaUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string | null;
  tenant: { id: string; name: string; slug: string; status: string } | null;
}

const KINDS = [
  { value: "all", label: "Todos" },
  { value: "owner", label: "Dueños" },
  { value: "staff", label: "Personal" },
] as const;

const EDITABLE_ROLES: Role[] = ["admin", "mecanico", "cajero", "contador"];

/** Lista de dueños y personal de todos los talleres, con búsqueda y edición. */
export function SaUsers() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("all");
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const [editing, setEditing] = useState<SaUser | null>(null);
  const list = useQuery({
    queryKey: ["sa-users", kind, dq],
    queryFn: () => api.get<{ items: SaUser[]; total: number }>("/superadmin/users", { kind, q: dq }),
  });

  return (
    <div>
      <PageHeader title="Usuarios" sub={list.data ? `${list.data.total} en la lista` : undefined} />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div role="tablist" aria-label="Tipo de usuario" className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 self-start">
          {KINDS.map((k) => (
            <button key={k.value} role="tab" aria-selected={kind === k.value} onClick={() => setKind(k.value)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium", kind === k.value ? "bg-white dark:bg-ink shadow-sm" : "muted")}>
              {k.label}
            </button>
          ))}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Nombre o correo" className="flex-1" />
      </div>
      {list.isLoading ? <PageLoader /> : (
        <DataTable
          rows={list.data?.items ?? []}
          rowKey={(u) => u.id}
          onRowClick={(u) => setEditing(u)}
          empty={<EmptyState icon={<Users />} title="Sin usuarios" />}
          columns={[
            { key: "name", header: "Usuario", cell: (u) => <span><span className="font-medium">{u.name}</span><span className="block text-xs muted">{u.email}</span></span> },
            { key: "taller", header: "Taller", cell: (u) => u.tenant ? <Link to={`/superadmin/talleres/${u.tenant.id}`} onClick={(e) => e.stopPropagation()} className="text-motor-dark font-medium">{u.tenant.name}</Link> : "—", hideMobile: true },
            { key: "role", header: "Rol", cell: (u) => <Badge>{ROLE_LABEL[u.role]}</Badge> },
            { key: "active", header: "Estado", cell: (u) => u.active ? <Badge tone="ok">activo</Badge> : <Badge tone="amber">inactivo</Badge> },
            { key: "last", header: "Último ingreso", cell: (u) => (u.lastLoginAt ? fmtDate(u.lastLoginAt) : "nunca"), hideMobile: true },
          ]}
        />
      )}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: SaUser; onClose: () => void }) {
  const qc = useQueryClient();
  const isOwner = user.role === "dueno";
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const save = useMutation({
    mutationFn: () => api.patch(`/superadmin/users/${user.id}`, {
      name,
      ...(isOwner ? {} : { role }),
      active,
    }),
    onSuccess: () => {
      toast.success("Usuario actualizado");
      qc.invalidateQueries({ queryKey: ["sa-users"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const changed = name !== user.name || (!isOwner && role !== user.role) || active !== user.active;
  const valid = name.trim().length >= 2;
  return (
    <Modal open onClose={onClose} title={`Editar a ${user.name}`} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!changed || !valid}>Guardar</Button>
      </>}>
      <div className="space-y-4">
        <p className="text-sm muted">{user.email} · {user.tenant?.name ?? "Sin taller"}</p>
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        {isOwner ? (
          <p className="text-xs muted">Los dueños no cambian de rol ni se desactivan desde aquí. Para cortar un taller, suspéndelo desde su ficha.</p>
        ) : (
          <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value as Role)}
            options={EDITABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        )}
        {!isOwner && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
            Cuenta activa (si la desactivas, no puede entrar)
          </label>
        )}
      </div>
    </Modal>
  );
}

interface Metrics {
  series: Array<{ month: string; tenants: number; orders: number; revenue: number }>;
  usersByRole: Array<{ role: Role; count: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  plans: Array<{ plan: string; count: number }>;
}

const money = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function Bars({ data, label, fmt = (n: number) => String(n) }: { data: Array<{ key: string; value: number }>; label: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2" role="list" aria-label={label}>
      {data.map((d) => (
        <div key={d.key} role="listitem" className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{d.key}</span>
          <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-motor" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="tabular-nums text-xs">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Métricas de la plataforma: últimos 6 meses, usuarios, órdenes y planes. */
export function SaMetrics() {
  const q = useQuery({ queryKey: ["sa-metrics"], queryFn: () => api.get<Metrics>("/superadmin/metrics") });
  if (q.isLoading || !q.data) return <PageLoader />;
  const m = q.data;
  const last = m.series[m.series.length - 1];
  const totalRevenue = m.series.reduce((a, s) => a + s.revenue, 0);
  const totalOrders = m.series.reduce((a, s) => a + s.orders, 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Métricas" sub="Últimos 6 meses, hora de Bogotá" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Talleres nuevos este mes" value={last?.tenants ?? 0} tone="motor" />
        <Stat label="Órdenes este mes" value={last?.orders ?? 0} />
        <Stat label="Facturado este mes" value={money(last?.revenue ?? 0)} />
        <Stat label="Facturado en 6 meses" value={money(totalRevenue)} sub={`${totalOrders} órdenes`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Talleres nuevos por mes</CardTitle>
          <Bars label="Talleres nuevos por mes" data={m.series.map((s) => ({ key: s.month, value: s.tenants }))} />
        </Card>
        <Card>
          <CardTitle>Órdenes por mes</CardTitle>
          <Bars label="Órdenes por mes" data={m.series.map((s) => ({ key: s.month, value: s.orders }))} />
        </Card>
        <Card>
          <CardTitle>Usuarios activos por rol</CardTitle>
          <Bars label="Usuarios por rol" data={m.usersByRole.map((r) => ({ key: ROLE_LABEL[r.role] ?? r.role, value: r.count }))} />
        </Card>
        <Card>
          <CardTitle>Órdenes por estado</CardTitle>
          <Bars label="Órdenes por estado" data={m.ordersByStatus.map((s) => ({ key: s.status, value: s.count }))} />
        </Card>
      </div>
    </div>
  );
}
