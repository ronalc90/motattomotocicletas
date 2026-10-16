import type { Request } from "express";
import type { ZodTypeAny, z } from "zod";

/** Parses req.body with a Zod schema; throws ZodError (handled globally as 400 VALIDATION). */
export function parseBody<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.body ?? {});
}

export function parseQuery<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.query ?? {});
}
