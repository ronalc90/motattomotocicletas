import dotenv from "dotenv";

dotenv.config();

const env = process.env;

export const config = {
  nodeEnv: env.NODE_ENV ?? "development",
  port: Number(env.PORT ?? 4000),
  mongoUri: env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/motatto",
  jwtSecret: env.JWT_SECRET ?? "dev-secret-change-me",
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
  superadminPassword: env.SUPERADMIN_PASSWORD ?? "Motatto2026!",
  seedOwnerPassword: env.SEED_OWNER_PASSWORD ?? "Motatto2026!",
  seedToken: env.SEED_TOKEN ?? "",
  timezone: "America/Bogota",
  isTest: env.NODE_ENV === "test" || !!env.VITEST,
};

export const r2Enabled = (): boolean =>
  !!(config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucket);
