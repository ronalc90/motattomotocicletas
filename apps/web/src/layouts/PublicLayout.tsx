import { Link, Outlet, useLocation } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { SiteHeader, siteLinks as links } from "@/components/layout/SiteHeader";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/utils";
import { CursorGlow } from "@/components/fx/CursorGlow";
import { useReveal } from "@/components/fx/useReveal";
import { useFxPointer } from "@/components/fx/useFxPointer";
import { ScrollRider } from "@/components/fx/ScrollRider";

export function PublicLayout() {
  const { pathname } = useLocation();
  useReveal(pathname);
  useFxPointer(pathname);
  return (
    <div className="min-h-dvh flex flex-col bg-white text-ink dark:bg-ink dark:text-slate-100">
      <CursorGlow />
      <ScrollRider />
      <SiteHeader />
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
