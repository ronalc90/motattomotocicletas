import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { nanoid } from "nanoid";
import { config, r2Enabled } from "../config.js";
import { badRequest } from "../lib/errors.js";

export const MAX_UPLOAD = 8 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const SHEET_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

export const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");

function makeMulter(filter: (mime: string, name: string) => boolean, max = MAX_UPLOAD) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: max, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (filter(file.mimetype, file.originalname)) cb(null, true);
      else cb(badRequest("Tipo de archivo no permitido", "BAD_FILE_TYPE"));
    },
  });
}

export const imageUpload = makeMulter((m) => IMAGE_TYPES.has(m));
export const sheetUpload = makeMulter((m, n) => SHEET_TYPES.has(m) || /\.(xlsx|csv)$/i.test(n));
export const audioUpload = makeMulter((m) => m.startsWith("audio/") || m === "video/webm" || m === "application/octet-stream", 25 * 1024 * 1024);

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extFor(mime: string, originalName?: string): string {
  if (EXT[mime]) return EXT[mime];
  const m = /\.([a-z0-9]{2,5})$/i.exec(originalName ?? "");
  return m ? m[1].toLowerCase() : "bin";
}

/** True when an R2 key belongs to this tenant (keys are tenants/<tenantId>/...). */
export function keyBelongsTo(tenantId: string, key: string): boolean {
  return key.startsWith(`tenants/${tenantId}/`) && !key.includes("..");
}

async function r2Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
  });
}

/** Reads a private R2 object (the bucket is not public; the API serves it after checking the tenant). */
export async function readFile(key: string): Promise<{ body: Buffer; contentType?: string }> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const out = await (await r2Client()).send(new GetObjectCommand({ Bucket: config.r2.bucket, Key: key }));
  if (!out.Body) throw new Error("empty object");
  return { body: Buffer.from(await out.Body.transformToByteArray()), contentType: out.ContentType };
}

/**
 * Stores a file and returns its URL. With R2 the bucket is private: the URL is /api/files/<key>,
 * served by the API after checking the tenant. Without R2, files go to local disk under /uploads.
 */
export async function storeFile(
  tenantId: string,
  file: { buffer: Buffer; mimetype: string; originalname?: string },
  folder = "misc",
): Promise<string> {
  const key = `tenants/${tenantId}/${folder}/${nanoid(16)}.${extFor(file.mimetype, file.originalname)}`;
  if (r2Enabled()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await r2Client()).send(
      new PutObjectCommand({ Bucket: config.r2.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }),
    );
    return `/api/files/${key}`;
  }
  const local = `${tenantId}/${nanoid(16)}.${extFor(file.mimetype, file.originalname)}`;
  const full = path.join(uploadsDir, local);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, file.buffer);
  const base = process.env.API_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  return `${base}/uploads/${local}`;
}
