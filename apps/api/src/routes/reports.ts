import { Router } from "express";
import { ReportQuerySchema } from "@motatto/shared";
import { requirePermission, requireTenant, wrap } from "../middleware/auth.js";
import { parseQuery } from "../middleware/validate.js";
import { salesReport, salesReportXlsx } from "../services/reportService.js";

export const reportsRouter = Router();
reportsRouter.use(requireTenant, requirePermission("reports:read"));

reportsRouter.get(
  "/sales",
  wrap(async (req, res) => {
    const q = parseQuery(ReportQuerySchema, req);
    const { orders: _o, ...report } = await salesReport(req.tenantId!, q.from, q.to);
    res.json(report);
  }),
);

reportsRouter.get(
  "/sales/export",
  wrap(async (req, res) => {
    const q = parseQuery(ReportQuerySchema, req);
    const buf = await salesReportXlsx(req.tenantId!, q.from, q.to);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="ventas-${q.from}-${q.to}.xlsx"`);
    res.send(buf);
  }),
);
