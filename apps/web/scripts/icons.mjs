// Generates public/icons/icon-192.png and icon-512.png from icon.svg
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(dir, "../public/icons/icon.svg"));
for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(path.join(dir, `../public/icons/icon-${size}.png`));
  console.log(`icon-${size}.png`);
}
