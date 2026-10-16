import { createElement } from "react";
import type { PublicInvoice } from "@motatto/shared";
import { downloadBlob } from "@/lib/api";

/** Lazy-loads @react-pdf/renderer and downloads the invoice PDF client-side. */
export async function downloadInvoicePdf(inv: PublicInvoice, logoSrc?: string) {
  const [{ pdf }, { InvoicePdf }] = await Promise.all([import("@react-pdf/renderer"), import("./InvoicePdf")]);
  let logo: string | undefined;
  if (logoSrc) {
    try {
      const res = await fetch(logoSrc, { mode: "cors" });
      const blob = await res.blob();
      if (/image\/(png|jpe?g)/.test(blob.type)) {
        logo = await new Promise<string>((ok, ko) => {
          const r = new FileReader();
          r.onload = () => ok(String(r.result));
          r.onerror = ko;
          r.readAsDataURL(blob);
        });
      }
    } catch {
      logo = undefined;
    }
  }
  const doc = createElement(InvoicePdf, { inv, logoSrc: logo }) as unknown as Parameters<typeof pdf>[0];
  const blob = await pdf(doc).toBlob();
  await downloadBlob(blob, `${inv.number}.pdf`);
}
