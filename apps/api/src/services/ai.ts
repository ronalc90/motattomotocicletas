import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export const AI_MODEL = "claude-sonnet-4-5";

export const aiEnabled = (): boolean => !!config.anthropicApiKey;

async function client() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: config.anthropicApiKey });
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

type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function askClaudeWithImage(
  prompt: string,
  image: { buffer: Buffer; mimetype: string },
  system?: string,
): Promise<string> {
  const anthropic = await client();
  const mediaType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(image.mimetype)
    ? image.mimetype
    : "image/jpeg") as ImageMedia;
  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image.buffer.toString("base64") } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return res.content
    .filter((b): b is { type: "text"; text: string } & typeof b => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export async function askClaude(prompt: string, system?: string, maxTokens = 1500): Promise<string> {
  const anthropic = await client();
  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .filter((b): b is { type: "text"; text: string } & typeof b => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export async function safeAsk<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err }, "AI call failed");
    return fallback;
  }
}
