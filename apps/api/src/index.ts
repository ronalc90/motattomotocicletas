import fs from "node:fs";
import mongoose from "mongoose";
import { config, r2Enabled } from "./config.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";
import { uploadsDir } from "./services/storage.js";

async function main() {
  if (!r2Enabled()) fs.mkdirSync(uploadsDir, { recursive: true });
  await mongoose.connect(config.mongoUri);
  logger.info("MongoDB connected");
  const app = createApp();
  const server = app.listen(config.port, () => logger.info(`API listening on :${config.port}`));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
