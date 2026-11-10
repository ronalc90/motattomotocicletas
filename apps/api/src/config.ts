import dotenv from "dotenv";

dotenv.config();

const env = process.env;
const isProduction = (env.NODE_ENV ?? "development") === "production";

/**
 * En producción estos valores son obligatorios: los de desarrollo están en el
 * repositorio (es público) y con ellos cualquiera firmaría tokens o entraría
 * como superadmin. Fuera de producción se usa el valor de desarrollo.
 */
function secret(name: string, devValue: string): string {
  const value = env[name];
  if (value) return value;
  if (isProduction) throw new Error(`Falta la variable de entorno ${name} (obligatoria en producción)`);
  return devValue;
}

export const config = {
  nodeEnv: env.NODE_ENV ?? "development",
  port: Number(env.PORT ?? 4000),
  mongoUri: env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/motatto",
  jwtSecret: secret("JWT_SECRET", "dev-secret-change-me"),
  jwtExpires: env.JWT_EXPIRES ?? "30d",
  corsOrigins: (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  webUrl: (env.WEB_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  openaiApiKey: env.OPENAI_API_KEY ?? "",
  r2: {
    accountId: env.R2_ACCOUNT_ID ?? "",
    accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: env.R2_BUCKET ?? "",
    publicUrl: (env.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
  },
  superadminEmail: env.SUPERADMIN_EMAIL ?? "superadmin@motatto.app",
  // Solo las usa el seed (se exigen al correrlo en producción, no al arrancar).
  superadminPassword: env.SUPERADMIN_PASSWORD ?? (isProduction ? "" : "Motatto2026!"),
  seedOwnerPassword: env.SEED_OWNER_PASSWORD ?? (isProduction ? "" : "Motatto2026!"),
  seedToken: env.SEED_TOKEN ?? "",
  timezone: "America/Bogota",
  isTest: env.NODE_ENV === "test" || !!env.VITEST,
};

export const r2Enabled = (): boolean =>
  !!(config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucket);
