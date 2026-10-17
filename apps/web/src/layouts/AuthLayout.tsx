import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CursorGlow } from "@/components/fx/CursorGlow";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/utils";

/** Marco de las pantallas de acceso (ingresar, registrar, invitación): mismo header y pie que el sitio público. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 text-ink dark:bg-ink dark:text-slate-100">
      <CursorGlow />
      <SiteHeader />
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="border-t border-slate-200 bg-white dark:bg-ink-2 dark:border-slate-800 py-4 text-center text-xs muted">
        <span>© {new Date().getFullYear()} Motatto · </span>
        <a className="hover:text-motor" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp 321 422 9804</a>
        <span> · </span>
        <a className="hover:text-motor" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <span> · </span>
        <Link className="hover:text-motor" to="/">Inicio</Link>
      </footer>
    </div>
  );
}
