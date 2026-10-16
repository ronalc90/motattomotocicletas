import mongoose from "mongoose";
import { config } from "./config.js";
import { runSeed } from "./services/seedService.js";

async function main() {
  await mongoose.connect(config.mongoUri);
  const result = await runSeed();
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
