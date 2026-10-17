import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export const siteLinks = [
  { to: "/", label: "Inicio", end: true },
  { to: "/como-funciona", label: "Cómo funciona" },
  { to: "/precios", label: "Precios" },
  { to: "/nosotros", label: "Nosotros" },
];

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-full px-3.5 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800", isActive && "bg-slate-100 dark:bg-slate-800");

/** Header compartido por todas las páginas públicas y de acceso, para que la navegación sea idéntica en cualquier pantalla. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const appHome = user?.role === "superadmin" ? "/superadmin" : "/app";
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur dark:bg-ink/90 dark:border-slate-800">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" aria-label="Motatto, inicio"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-1">
          {siteLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={navItem}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <Link to={appHome}><Button variant="dark" size="sm">Ir a mi taller</Button></Link>
          ) : (
            <>
              <NavLink to="/login" className={navItem}>Ingresar</NavLink>
              <Link to="/registro"><Button size="sm">Registrar mi taller</Button></Link>
            </>
          )}
        </div>
        <button className="md:hidden tap inline-flex items-center justify-center rounded-btn" onClick={() => setOpen((v) => !v)} aria-label="Menú" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="md:hidden border-t border-slate-200 px-4 py-3 flex flex-col gap-1 dark:border-slate-800">
          {siteLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)} className="rounded-btn px-3 py-3 text-base font-medium hover:bg-slate-100 dark:hover:bg-slate-800">{l.label}</NavLink>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            {user ? (
              <Link to={appHome} onClick={() => setOpen(false)}><Button variant="dark" full>Ir a mi taller</Button></Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)}><Button variant="secondary" full>Ingresar</Button></Link>
                <Link to="/registro" onClick={() => setOpen(false)}><Button full>Registrar mi taller</Button></Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
