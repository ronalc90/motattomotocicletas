import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { recordAi } from "../lib/aiUsage.js";

/** OpenAI models. Vision + text on one model; Whisper for speech. */
export const AI_MODEL = "gpt-4o-mini";
export const AI_STT_MODEL = "whisper-1";

export const aiEnabled = (): boolean => !!config.openaiApiKey;

async function client() {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: config.openaiApiKey });
}

/** Extracts the first JSON object from a model response, tolerating code fences and prose. */
export function extractJson<T = unknown>(text: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start === -1 || end === -1) continue;
    try {
      return JSON.parse(c.slice(start, end + 1)) as T;
    } catch {
      /* try next */
    }
  }
  return null;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function askWithImage(
  prompt: string,
  image: { buffer: Buffer; mimetype: string },
  system?: string,
  tenantId?: string,
): Promise<string> {
  const openai = await client();
  const mediaType = IMAGE_TYPES.includes(image.mimetype) ? image.mimetype : "image/jpeg";
  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: 1024,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${image.buffer.toString("base64")}`, detail: "high" } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  if (tenantId) await recordAi(tenantId, { promptTokens: res.usage?.prompt_tokens, completionTokens: res.usage?.completion_tokens });
  return res.choices[0]?.message?.content ?? "";
}

export async function ask(prompt: string, system?: string, maxTokens = 1500, tenantId?: string): Promise<string> {
  const openai = await client();
  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [...(system ? [{ role: "system" as const, content: system }] : []), { role: "user", content: prompt }],
  });
  if (tenantId) await recordAi(tenantId, { promptTokens: res.usage?.prompt_tokens, completionTokens: res.usage?.completion_tokens });
  return res.choices[0]?.message?.content ?? "";
}

/** Speech-to-text with Whisper (Spanish). */
export async function transcribeAudio(audio: { buffer: Buffer; mimetype: string; originalname?: string; tenantId?: string }): Promise<string> {
  const openai = await client();
  const { toFile } = await import("openai");
  const ext = audio.mimetype.includes("webm") ? "webm" : audio.mimetype.includes("mp4") || audio.mimetype.includes("m4a") ? "m4a" : audio.mimetype.includes("wav") ? "wav" : audio.mimetype.includes("ogg") ? "ogg" : "mp3";
  const file = await toFile(audio.buffer, audio.originalname || `audio.${ext}`, { type: audio.mimetype });
  const res = await openai.audio.transcriptions.create({
    model: AI_STT_MODEL,
    file,
    language: "es",
    prompt: "Taller de motos y carros en Colombia. Repuestos, servicios, precios en pesos.",
  });
  if (audio.tenantId) await recordAi(audio.tenantId, { transcription: true, audioSeconds: Math.round(audio.buffer.length / 16000) });
  return res.text;
}

// Backwards-compatible aliases used by labelReader/assistant.
export const askClaudeWithImage = askWithImage;
export const askClaude = ask;

export async function safeAsk<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err }, "AI call failed");
    return fallback;
  }
}
