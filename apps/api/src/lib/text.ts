/** Lowercase, strip accents and non alphanumerics for fuzzy matching. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return normalize(s)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ACCENT_CLASSES: Record<string, string> = {
  a: "[aáàäâã]",
  e: "[eéèëê]",
  i: "[iíìïî]",
  o: "[oóòöôõ]",
  u: "[uúùüû]",
  n: "[nñ]",
  c: "[cç]",
};

/** Case- and accent-insensitive search regex: "bujia" matches "Bujía". */
export function searchRegex(q: string): RegExp {
  const base = q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const pattern = escapeRegex(base)
    .split("")
    .map((ch) => ACCENT_CLASSES[ch] ?? ch)
    .join("");
  return new RegExp(pattern, "i");
}

/** Removes emoji and other non Latin-1 symbols (for PDF fonts). */
export function stripEmoji(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();
}
