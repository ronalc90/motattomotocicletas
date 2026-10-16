import type { ReactNode } from "react";
import type { OrderStatus, Plan, Role, TenantStatus } from "@motatto/shared";
import { ORDER_STATUS_LABEL, ROLE_LABEL } from "@motatto/shared";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "motor" | "amber" | "ok" | "bad" | "blue" | "violet" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  motor: "bg-motor-soft text-motor-dark dark:bg-motor/20 dark:text-orange-300",
  amber: "bg-amber-soft text-amber-800 dark:bg-amber/20 dark:text-amber-200",
  ok: "bg-ok-soft text-ok dark:bg-green-900/40 dark:text-green-300",
  bad: "bg-bad-soft text-bad dark:bg-red-900/40 dark:text-red-300",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  dark: "bg-ink text-white",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  recibida: "blue",
  cotizada: "violet",
  en_proceso: "amber",
  terminada: "motor",
  pagada: "ok",
  anulada: "bad",
};
export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return <Badge tone={STATUS_TONE[status]} className={className} dot>{ORDER_STATUS_LABEL[status]}</Badge>;
}

const ROLE_TONE: Record<Role, Tone> = { superadmin: "dark", dueno: "motor", admin: "violet", mecanico: "blue", cajero: "ok", contador: "neutral" };
export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>;
}

export function PlanBadge({ plan }: { plan: Plan }) {
  return <Badge tone={plan === "pro" ? "motor" : "neutral"}>{plan === "pro" ? "Pro" : "Gratis"}</Badge>;
}
export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return <Badge tone={status === "activo" ? "ok" : "bad"} dot>{status === "activo" ? "Activo" : "Suspendido"}</Badge>;
}

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const tone: Tone = stock <= 0 ? "bad" : stock <= minStock ? "amber" : "ok";
  return <Badge tone={tone}>{stock <= 0 ? "Sin stock" : `${stock} en stock`}</Badge>;
}
