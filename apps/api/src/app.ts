import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { auth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { uploadsDir } from "./services/storage.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";
import { tenantRouter } from "./routes/tenant.js";
import { usersRouter } from "./routes/users.js";
import { customersRouter } from "./routes/customers.js";
import { vehiclesRouter } from "./routes/vehicles.js";
import { productsRouter } from "./routes/products.js";
import { movementsRouter } from "./routes/movements.js";
import { servicesRouter } from "./routes/services.js";
import { ordersRouter } from "./routes/orders.js";
import { cashRouter, expensesRouter, paymentsRouter } from "./routes/cash.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { reportsRouter } from "./routes/reports.js";
import { assistantRouter } from "./routes/assistant.js";
import { auditRouter, uploadsRouter } from "./routes/misc.js";
import { filesRouter } from "./routes/files.js";
import { superadminRouter } from "./routes/superadmin.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) return cb(null, true);
        if (config.nodeEnv !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        return cb(new Error("CORS: origen no permitido"), false);
      },
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "2mb" }));
  if (!config.isTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req: { url?: string }) => req.url === "/health" } }));
  }

  app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  app.use(
    "/api/auth",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 10000 : 60, standardHeaders: true, legacyHeaders: false }),
    authRouter,
  );
  app.use("/api/public", publicRouter);
  app.use("/uploads", express.static(uploadsDir, { maxAge: "7d", index: false }));
  app.use("/api/superadmin", superadminRouter);

  // Tenant routes (auth required)
  app.use("/api", auth);
  app.use("/api/files", filesRouter);
  app.use("/api/tenant", tenantRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/vehicles", vehiclesRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/movements", movementsRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/cash", cashRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/assistant", assistantRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/audit", auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
