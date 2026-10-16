import type { ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin muted", className)} />;
}

export function PageLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 muted">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, text, action, className }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-4 gap-2", className)}>
      {icon && <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-motor-soft text-motor-dark dark:bg-motor/20 dark:text-orange-300">{icon}</div>}
      <h3 className="font-semibold text-base">{title}</h3>
      {text && <p className="text-sm muted max-w-sm">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Buscar…", autoFocus, className }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 muted" />
      <input type="search" value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field pl-9 pr-9" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Limpiar" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string; count?: number }>; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none", className)} role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}
          className={cn("whitespace-nowrap rounded-full px-3.5 h-9 text-sm font-medium transition-colors shrink-0",
            value === it.value ? "bg-ink text-white dark:bg-slate-100 dark:text-ink" : "hover:bg-slate-100 dark:hover:bg-slate-800 muted")}>
          {it.label}
          {it.count !== undefined && <span className={cn("ml-1.5 text-xs", value === it.value ? "opacity-70" : "")}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, action, back }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        {sub && <div className="text-sm muted mt-0.5">{sub}</div>}
      </div>
      {action && <div className="flex gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1.5 text-[15px]", strong && "font-bold text-lg")}>
      <span className={strong ? "" : "muted"}>{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const ini = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white text-xs font-bold dark:bg-slate-200 dark:text-ink", className)}>{ini}</span>;
}
