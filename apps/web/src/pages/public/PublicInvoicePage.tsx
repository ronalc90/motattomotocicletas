import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Download, MessageCircle, Printer, Share2 } from "lucide-react";
import type { PublicInvoice } from "@motatto/shared";
import { renderInvoiceText, whatsappLink } from "@motatto/shared";
import { API_BASE, api, assetUrl, errorMessage } from "@/lib/api";
import { Button, EmptyState, PageLoader } from "@/components/ui";
import { InvoiceView } from "@/components/invoice/InvoiceView";
import { downloadInvoicePdf } from "@/components/invoice/downloadPdf";
import { Logo } from "@/components/layout/Logo";
import { copyText } from "@/lib/utils";
import { useState } from "react";

export function PublicInvoicePage() {
  const { tenantSlug = "", number = "" } = useParams();
  // Clave aleatoria del link (?k=): sin ella la API no muestra la cuenta de cobro.
  const k = useSearchParams()[0].get("k") ?? "";
  const q = useQuery({ queryKey: ["public-invoice", tenantSlug, number, k], queryFn: () => api.get<PublicInvoice>(`/public/invoices/${tenantSlug}/${number}`, { k }) });
  const [pdfLoading, setPdfLoading] = useState(false);
  const inv = q.data;
  const pdfApi = `${API_BASE}/public/invoices/${tenantSlug}/${number}/pdf?k=${encodeURIComponent(k)}`;

  async function pdf() {
    if (!inv) return;
    setPdfLoading(true);
    try { await downloadInvoicePdf(inv, assetUrl(inv.tenant.logoUrl)); }
    catch { window.open(pdfApi, "_blank"); }
    finally { setPdfLoading(false); }
  }
  async function share() {
    if (!inv) return;
    const data = { title: `Cuenta de cobro ${inv.number}`, text: `${inv.tenant.name} · Cuenta de cobro ${inv.number}`, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
    else { await copyText(location.href); toast.success("Link copiado"); }
  }

  return (
    <div className="min-h-dvh bg-surface dark:bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {q.isLoading ? <PageLoader /> : q.isError || !inv ? (
          <EmptyState title="No encontramos esta cuenta de cobro" text={q.error ? errorMessage(q.error) : "Revisa el link que te enviaron."} />
        ) : (
          <>
            <InvoiceView inv={inv} />
            <div className="no-print mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button onClick={pdf} loading={pdfLoading} icon={<Download className="h-4 w-4" />}>Descargar PDF</Button>
              <Button variant="secondary" onClick={() => copyText(renderInvoiceText(inv)).then(() => toast.success("Texto copiado"))} icon={<Copy className="h-4 w-4" />}>Copiar texto</Button>
              {inv.tenant.phone && (
                <a href={whatsappLink(inv.tenant.phone, `Hola, escribo por la cuenta de cobro ${inv.number}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-btn bg-ok text-white h-11 px-4 font-semibold text-[15px]"><MessageCircle className="h-4 w-4" /> WhatsApp del taller</a>
              )}
              <Button variant="secondary" onClick={share} icon={<Share2 className="h-4 w-4" />}>Compartir</Button>
            </div>
            <div className="no-print mt-3 flex items-center justify-between text-xs muted">
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 hover:text-motor"><Printer className="h-3.5 w-3.5" /> Imprimir</button>
              <a href={pdfApi} target="_blank" rel="noreferrer" className="hover:text-motor">PDF desde el servidor</a>
            </div>
          </>
        )}
        <div className="no-print mt-10 flex flex-col items-center gap-1 text-xs muted">
          <Logo className="text-base" />
          <span>Cuentas de cobro generadas con Motatto · motattomotocicletas.com</span>
        </div>
      </div>
    </div>
  );
}
