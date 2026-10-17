import type { Types } from "mongoose";
import { AiUsage, Tenant } from "../models/index.js";
import { AppError } from "./errors.js";

/** Precios aproximados (USD) para estimar costo: gpt-4o-mini y whisper-1. */
const PRICE = { inputPerMTok: 0.15, outputPerMTok: 0.6, whisperPerMin: 0.006 };

/** Mes en hora de Colombia ("YYYY-MM"), para que el corte mensual sea local. */
export function currentMonth(now = new Date()): string {
  return new Date(now.getTime() - 5 * 3600_000).toISOString().slice(0, 7);
}

export interface AiQuota {
  limit: number;
  used: number;
  remaining: number;
  over: boolean;
}

export async function aiQuota(tenantId: string | Types.ObjectId): Promise<AiQuota> {
  const [t, u] = await Promise.all([
    Tenant.findById(tenantId).select("aiCallsLimit").lean(),
    AiUsage.findOne({ tenantId, month: currentMonth() }).select("calls").lean(),
  ]);
  const limit = t?.aiCallsLimit ?? 300;
  const used = u?.calls ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used), over: used >= limit };
}

/** True when the tenant has used its monthly AI allowance. */
export async function aiOverLimit(tenantId: string | Types.ObjectId): Promise<boolean> {
  return (await aiQuota(tenantId)).over;
}

export async function assertAiQuota(tenantId: string | Types.ObjectId): Promise<void> {
  if (await aiOverLimit(tenantId)) {
    throw new AppError(429, "AI_LIMIT", "Llegaste al límite mensual de IA de tu taller. Puedes seguir usando el buscador local o pedir más al administrador.");
  }
}

/** Registra una llamada de IA. Nunca lanza: medir no debe romper el flujo del usuario. */
export async function recordAi(
  tenantId: string | Types.ObjectId,
  u: { promptTokens?: number; completionTokens?: number; transcription?: boolean; audioSeconds?: number },
): Promise<void> {
  try {
    const p = u.promptTokens ?? 0;
    const c = u.completionTokens ?? 0;
    const audio = u.audioSeconds ?? 0;
    const cost = (p * PRICE.inputPerMTok + c * PRICE.outputPerMTok) / 1_000_000 + (audio / 60) * PRICE.whisperPerMin;
    await AiUsage.updateOne(
      { tenantId, month: currentMonth() },
      {
        $inc: {
          calls: 1,
          promptTokens: p,
          completionTokens: c,
          transcriptions: u.transcription ? 1 : 0,
          audioSeconds: audio,
          costUsd: cost,
        },
      },
      { upsert: true },
    );
  } catch {
    /* la medición es best-effort */
  }
}
