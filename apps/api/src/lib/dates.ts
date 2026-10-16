import { config } from "../config.js";

/** Returns YYYY-MM-DD for a date in the workshop timezone (America/Bogota). */
export function toDayString(d: Date = new Date(), tz = config.timezone): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Offset (ms) of a timezone at a given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asUtc - date.getTime();
}

/** [start, end) UTC instants for a YYYY-MM-DD day in the workshop timezone. */
export function dayRange(day: string, tz = config.timezone): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0);
  const guess = new Date(naive);
  const offset = tzOffsetMs(guess, tz);
  const start = new Date(naive - offset);
  const naiveEnd = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  const end = new Date(naiveEnd - tzOffsetMs(new Date(naiveEnd), tz));
  return { start, end };
}

/** [start of `from`, end of `to`) for a report range. */
export function rangeOf(from: string, to: string): { start: Date; end: Date } {
  return { start: dayRange(from).start, end: dayRange(to).end };
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** Iterate every day (YYYY-MM-DD) between from and to inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  let cur = Date.UTC(y, m - 1, d);
  const [y2, m2, d2] = to.split("-").map(Number);
  const end = Date.UTC(y2, m2 - 1, d2);
  while (cur <= end && out.length < 1000) {
    out.push(new Date(cur).toISOString().slice(0, 10));
    cur += 86_400_000;
  }
  return out;
}

export function monthStart(d: Date = new Date()): Date {
  const day = toDayString(d);
  return dayRange(`${day.slice(0, 7)}-01`).start;
}
