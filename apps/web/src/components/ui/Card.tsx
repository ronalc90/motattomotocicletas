import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-4 sm:p-5", className)} {...rest} />;
}

export function CardTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h3 className="text-base font-semibold">{children}</h3>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "default", className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "motor" | "ok" | "bad" | "dark"; className?: string }) {
  const tones = {
    default: "card",
    motor: "bg-motor text-white border-transparent rounded-card",
    ok: "bg-ok text-white border-transparent rounded-card",
    bad: "bg-bad-soft text-bad rounded-card",
    dark: "bg-ink text-white rounded-card",
  };
  return (
    <div className={cn("p-4 flex flex-col gap-1 min-w-0", tones[tone], className)}>
      <span className={cn("text-xs font-medium", tone === "default" ? "muted" : "opacity-80")}>{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums leading-tight truncate">{value}</span>
      {sub && <span className={cn("text-xs", tone === "default" ? "muted" : "opacity-80")}>{sub}</span>}
    </div>
  );
}
