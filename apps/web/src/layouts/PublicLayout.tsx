import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui";
import { cn, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const links = [
  { to: "/", label: "Inicio", end: true },
  { to: "/como-funciona", label: "Cómo funciona" },
  { to: "/precios", label: "Precios" },
  { to: "/nosotros", label: "Nosotros" },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const appHome = user?.role === "superadmin" ? "/superadmin" : "/app";
  return (
    <div className="min-h-dvh flex flex-col bg-white text-ink dark:bg-ink dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:bg-ink/85 dark:border-slate-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="Motatto, inicio"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn("rounded-full px-3.5 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800", isActive && "bg-slate-100 dark:bg-slate-800")}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Link to={appHome}><Button variant="dark" size="sm">Ir a mi taller</Button></Link>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-3.5 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">Ingresar</Link>
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
            {links.map((l) => (
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
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-slate-200 bg-slate-50 dark:bg-ink-2 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <Logo />
            <p className="mt-3 muted max-w-xs">Facturas, inventario con fotos, clientes y caja para talleres de motos y carros en Colombia.</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Producto</span>
            {links.map((l) => <Link key={l.to} to={l.to} className="muted hover:text-motor">{l.label}</Link>)}
            <Link to="/registro" className="muted hover:text-motor">Registrar mi taller</Link>
            <Link to="/login" className="muted hover:text-motor">Ingresar</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Contacto</span>
            <a className="muted hover:text-motor" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp 321 422 9804</a>
            <a className="muted hover:text-motor" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            <span className="muted">Bogotá, Colombia</span>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs muted">© {new Date().getFullYear()} Motatto. Hecho en un taller de motos.</div>
      </footer>
    </div>
  );
}
