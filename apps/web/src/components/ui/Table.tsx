import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** hide on mobile card view */
  hideMobile?: boolean;
  align?: "left" | "right";
}

/** Table on ≥sm, stacked cards on mobile. */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, className }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode; className?: string }) {
  if (!rows.length) return <>{empty ?? null}</>;
  return (
    <div className={className}>
      <div className="hidden sm:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b line text-left muted">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 font-medium whitespace-nowrap", c.align === "right" && "text-right", c.className)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={() => onRowClick?.(r)} className={cn("border-b line last:border-0", onRowClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 align-middle", c.align === "right" && "text-right tabular-nums", c.className)}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="sm:hidden space-y-2">
        {rows.map((r) => (
          <li key={rowKey(r)} onClick={() => onRowClick?.(r)} className={cn("card p-3.5", onRowClick && "active:bg-slate-50 dark:active:bg-slate-800")}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {columns.filter((c) => !c.hideMobile).map((c) => (
                <div key={c.key} className="contents">
                  <dt className="muted text-xs pt-0.5">{c.header}</dt>
                  <dd className={cn("min-w-0", c.align === "right" && "text-right tabular-nums")}>{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
