import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Boxes, ChevronDown, ClipboardList, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Mic, Settings, Users, Wallet, Wrench } from "lucide-react";
import type { Permission } from "@motatto/shared";
import { ROLE_LABEL } from "@motatto/shared";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/hooks/useCan";
import { Logo } from "@/components/layout/Logo";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; perm?: Permission; end?: boolean; mobile?: boolean }
const NAV: NavItem[] = [
  { to: "/app", label: "Panel", icon: LayoutDashboard, end: true, mobile: true },
  { to: "/app/ordenes", label: "Órdenes", icon: ClipboardList, perm: "orders:read", mobile: true },
  { to: "/app/asistente", label: "Asistente", icon: Mic, perm: "assistant:use", mobile: true },
  { to: "/app/clientes", label: "Clientes", icon: Users, perm: "customers:read" },
  { to: "/app/inventario", label: "Inventario", icon: Boxes, perm: "inventory:read", mobile: true },
  { to: "/app/servicios", label: "Servicios", icon: Wrench, perm: "services:manage" },
  { to: "/app/caja", label: "Caja", icon: Wallet, perm: "cash:read", mobile: true },
  { to: "/app/reportes", label: "Reportes", icon: BarChart3, perm: "reports:read" },
  { to: "/app/configuracion", label: "Configuración", icon: Settings, perm: "tenant:settings" },
];

export function AppShell() {
  const { user, tenant, role, logout, exitSupport } = useAuth();
  const can = useCan();
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const items = NAV.filter((i) => !i.perm || can(i.perm));
  const mobileItems = items.filter((i) => i.mobile).slice(0, 5);
  const hideBottom = loc.pathname.startsWith("/app/asistente") || loc.pathname === "/app/bienvenida";

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-ink text-slate-200 sticky top-0 h-dvh">
        <div className="px-5 h-16 flex items-center border-b border-white/10"><Link to="/app"><Logo light /></Link></div>
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-xs text-slate-400">Taller</div>
          <div className="font-display font-semibold truncate">{tenant?.name ?? "—"}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn("flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "bg-motor text-white" : "hover:bg-white/10 text-slate-300")}>
              <i.icon className="h-5 w-5" /> {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 text-xs text-slate-400">{user?.name} · {role ? ROLE_LABEL[role] : ""}</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {user?.impersonating && (
          <div className="bg-amber text-ink text-sm px-4 py-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium"><LifeBuoy className="h-4 w-4" /> Modo soporte: estás dentro de {tenant?.name}</span>
            <button className="underline font-semibold" onClick={() => void exitSupport().then(() => nav("/superadmin/talleres"))}>Salir del modo soporte</button>
          </div>
        )}
        {tenant?.status === "suspendido" && (
          <div className="bg-bad text-white text-sm px-4 py-2 font-medium">Este taller está suspendido. Solo puedes consultar. Escríbenos por WhatsApp al 321 422 9804.</div>
        )}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-3 px-4 border-b line bg-[var(--card)]/90 backdrop-blur">
          <div className="min-w-0 lg:hidden"><Link to="/app"><Logo className="text-lg" /></Link></div>
          <div className="hidden lg:block text-sm muted truncate">{tenant?.city ? `${tenant.name} · ${tenant.city}` : tenant?.name}</div>
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-haspopup="menu" aria-expanded={menu}>
              <Avatar name={user?.name ?? "?"} className="h-8 w-8" />
              <span className="hidden sm:block text-sm font-medium max-w-[140px] truncate">{user?.name}</span>
              <ChevronDown className="h-4 w-4 muted" />
            </button>
            {menu && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label="Cerrar menú" onClick={() => setMenu(false)} />
                <div className="absolute right-0 mt-2 w-60 card p-1.5 z-20 shadow-float" role="menu">
                  <div className="px-3 py-2 text-xs muted">
                    <div className="font-medium text-current truncate">{user?.email}</div>
                    {role ? ROLE_LABEL[role] : ""}
                  </div>
                  <Link to="/app/configuracion?tab=cuenta" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-btn px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><KeyRound className="h-4 w-4" /> Cambiar contraseña</Link>
                  <button onClick={() => { setMenu(false); logout(); nav("/login"); }} className="flex w-full items-center gap-2 rounded-btn px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-left"><LogOut className="h-4 w-4" /> Cerrar sesión</button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className={cn("flex-1 px-4 py-4 sm:px-6 sm:py-6 max-w-6xl w-full mx-auto", !hideBottom && "pb-24 lg:pb-6")}><Outlet /></main>
        {!hideBottom && (
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t line bg-[var(--card)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
            <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, 1fr)` }}>
              {mobileItems.map((i) => (
                <li key={i.to}>
                  <NavLink to={i.to} end={i.end} className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium min-h-[56px] justify-center", isActive ? "text-motor" : "muted")}>
                    {i.to === "/app/asistente" ? (
                      <span className="-mt-5 h-12 w-12 rounded-full bg-motor text-white flex items-center justify-center shadow-float"><Mic className="h-5 w-5" /></span>
                    ) : (
                      <i.icon className="h-5 w-5" />
                    )}
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
