import { Router } from "express";
import { Order, Tenant } from "../models/index.js";
import { wrap } from "../middleware/auth.js";
import { notFound } from "../lib/errors.js";
import { invoicePayload } from "../services/orderService.js";
import { renderInvoicePdf } from "../services/pdf.js";

export const publicRouter = Router();

/**
 * El slug es público y el número es consecutivo, así que no bastan para abrir la cuenta de cobro:
 * se exige además la clave aleatoria de la orden (?k=). Solo se acepta un string (nunca un objeto
 * con operadores de Mongo como k[$ne]=x).
 */
async function findInvoice(slug: string, number: string, key: unknown) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(key)) throw notFound("Cuenta de cobro");
  const tenant = await Tenant.findOne({ slug });
  if (!tenant) throw notFound("Taller");
  const order = await Order.findOne({ tenantId: tenant._id, number: number.toUpperCase(), publicToken: key });
  if (!order) throw notFound("Cuenta de cobro");
  return { tenant, order };
}

publicRouter.get(
  "/tenants/:slug",
  wrap(async (req, res) => {
    const t = await Tenant.findOne({ slug: req.params.slug });
    if (!t) throw notFound("Taller");
    res.json({
      name: t.name,
      slogan: t.settings.slogan || undefined,
      address: t.settings.address || t.address || undefined,
      phone: t.settings.phone || t.phone || undefined,
      logoUrl: t.settings.logoUrl || undefined,
      type: t.type,
    });
  }),
);

publicRouter.get(
  "/invoices/:tenantSlug/:number",
  wrap(async (req, res) => {
    const { tenant, order } = await findInvoice(req.params.tenantSlug, req.params.number, req.query.k);
    const { invoice } = await invoicePayload(tenant, order);
    res.json(invoice);
  }),
);

publicRouter.get(
  "/invoices/:tenantSlug/:number/pdf",
  wrap(async (req, res) => {
    const { tenant, order } = await findInvoice(req.params.tenantSlug, req.params.number, req.query.k);
    const { invoice } = await invoicePayload(tenant, order);
    const pdf = await renderInvoicePdf(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${order.number}.pdf"`);
    res.send(pdf);
  }),
);
