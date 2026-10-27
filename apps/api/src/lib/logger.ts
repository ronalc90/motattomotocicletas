import pino from "pino";
import { pinoHttp } from "pino-http";
import { config } from "../config.js";

export const logger = pino({
  level: config.isTest ? "silent" : process.env.LOG_LEVEL ?? "info",
});

const HIDDEN = "[oculto]";
/** Cabeceras con credenciales: el JWT de sesión (30 días) y el token del seed. */
const SECRET_HEADERS = ["authorization", "cookie", "x-seed-token"];
/** Parámetros con credenciales: ?token=<JWT> (fotos y PDF) y ?k= (clave del link público). */
const SECRET_QUERY = ["token", "k"];

export function redactUrl(url: string): string {
  return url.replace(/([?&](?:token|k)=)[^&#]*/gi, `$1${HIDDEN}`);
}

/**
 * Serializador de la petición para los logs: copia (no modifica la petición real) sin credenciales.
 * Recibe la petición ya serializada por pino-std-serializers.
 */
function safeRequest(req: Record<string, unknown>): Record<string, unknown> {
  const headers = { ...((req.headers as Record<string, unknown> | undefined) ?? {}) };
  for (const h of SECRET_HEADERS) if (headers[h] !== undefined) headers[h] = HIDDEN;
  let query = req.query;
  if (query && typeof query === "object") {
    const q = { ...(query as Record<string, unknown>) };
    for (const k of SECRET_QUERY) if (q[k] !== undefined) q[k] = HIDDEN;
    query = q;
  }
  return { ...req, url: typeof req.url === "string" ? redactUrl(req.url) : req.url, query, headers };
}

/** Middleware de logs HTTP que no guarda JWT, token de seed ni claves de links públicos. */
export function httpLogger(base: pino.Logger) {
  return pinoHttp({
    logger: base,
    serializers: { req: safeRequest },
    autoLogging: { ignore: (req: { url?: string }) => req.url === "/health" },
  });
}
