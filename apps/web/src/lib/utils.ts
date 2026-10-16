import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return format(parseISO(iso), "d MMM yyyy", { locale: es });
}
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return format(parseISO(iso), "d MMM yyyy, h:mm a", { locale: es });
}
export function fmtDay(day: string): string {
  // YYYY-MM-DD → "lun 12 oct"
  return format(parseISO(day), "EEE d MMM", { locale: es });
}
export function ago(iso?: string | null): string {
  if (!iso) return "";
  return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: true });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export const SUPPORT_WHATSAPP = "573214229804";
export const SUPPORT_EMAIL = "dirox7@gmail.com";
