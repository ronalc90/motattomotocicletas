import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, LogOut, PieChart, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/superadmin", label: "Estadísticas", icon: PieChart, end: true },
  { to: "/superadmin/talleres", label: "Talleres", icon: Building2 },
  { to: "/superadmin/ia", label: "Uso IA", icon: Sparkles },
];

export function SuperadminShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/superadmin" className="flex items-center gap-3"><Logo light /><span className="text-xs rounded-full bg-amber text-ink px-2 py-0.5 font-semibold">Plataforma</span></Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn("flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium", isActive ? "bg-white/15" : "hover:bg-white/10")}>
                <n.icon className="h-4 w-4" /> <span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
            <button onClick={() => { logout(); nav("/login"); }} className="ml-1 flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10" title={user?.email}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Salir</span></button>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6"><Outlet /></main>
    </div>
  );
}
