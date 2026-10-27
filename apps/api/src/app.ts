import express, { type RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { httpLogger, logger } from "./lib/logger.js";
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

/** Peticiones permitidas por IP en cada ventana de 15 minutos. */
export interface RateLimits {
  /** /api/auth salvo /me y /logout: login, registro, cambio de contraseña e invitaciones. */
  credentials: number;
  /**
   * GET /api/auth/me, que la web llama en cada carga de página. Es holgado porque los
   * celulares de un taller suelen salir a internet por la misma IP pública.
   */
  session: number;
  /** /api/public (cuenta de cobro y datos públicos del taller). */
  public: number;
}

export const RATE_LIMITS: RateLimits = { credentials: 60, session: 1000, public: 300 };
// Los tests comparten una app y hacen cientos de peticiones desde 127.0.0.1. Los que
// prueban los límites crean su propia app con createApp({ rateLimits: RATE_LIMITS }).
const TEST_RATE_LIMITS: RateLimits = { credentials: 10000, session: 10000, public: 10000 };

// Rutas de /api/auth que no reciben credenciales y no deben gastar ese cupo. /logout no
// existe hoy (la web cierra sesión borrando su token), pero si se agrega queda aquí.
const SESSION_PATHS = new Set(["/me", "/logout"]);

function limiter(limit: number): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Demasiadas peticiones desde esta red. Espera unos minutos e intenta de nuevo." } },
  });
}

export function createApp(opts: { rateLimits?: Partial<RateLimits> } = {}) {
  const limits: RateLimits = { ...(config.isTest ? TEST_RATE_LIMITS : RATE_LIMITS), ...opts.rateLimits };
  const credentialsLimiter = limiter(limits.credentials);
  const sessionLimiter = limiter(limits.session);
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
  if (!config.isTest) app.use(httpLogger(logger));

  app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  // El límite estricto es para quien prueba contraseñas o tokens de invitación. Cualquier
  // ruta nueva de /api/auth queda en él salvo que se agregue a SESSION_PATHS. El router
  // ignora mayúsculas y la barra final, así que la comparación también.
  app.use(
    "/api/auth",
    (req, res, next) => {
      const path = req.path.replace(/\/+$/, "").toLowerCase();
      return (SESSION_PATHS.has(path) ? sessionLimiter : credentialsLimiter)(req, res, next);
    },
    authRouter,
  );
  app.use("/api/public", limiter(limits.public), publicRouter);
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
