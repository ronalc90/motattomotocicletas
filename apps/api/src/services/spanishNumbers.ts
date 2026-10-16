import { normalize } from "../lib/text.js";

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

const NUMBER_WORDS = new Set([...Object.keys(UNITS), ...Object.keys(HUNDREDS), "mil", "millon", "millones", "y", "lucas", "pesos", "barras"]);

/** Parses a Spanish number phrase ("treinta y dos mil", "26 mil", "274.000") into an integer. */
export function parseSpanishNumber(phrase: string): number | null {
  const words = normalize(phrase).split(" ").filter(Boolean);
  if (!words.length) return null;
  let total = 0;
  let current = 0;
  let any = false;
  for (const w of words) {
    if (/^\d+$/.test(w)) {
      current += Number(w);
      any = true;
    } else if (UNITS[w] !== undefined) {
      current += UNITS[w];
      any = true;
    } else if (HUNDREDS[w] !== undefined) {
      current += HUNDREDS[w];
      any = true;
    } else if (w === "mil" || w === "lucas") {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      any = true;
    } else if (w === "millon" || w === "millones") {
      current = (current || 1) * 1_000_000;
      total += current;
      current = 0;
      any = true;
    } else if (w === "y" || w === "pesos" || w === "barras") {
      continue;
    } else {
      return null;
    }
  }
  if (!any) return null;
  return total + current;
}

export const isNumberWord = (w: string): boolean => NUMBER_WORDS.has(w) || /^\d+$/.test(w);

/**
 * Finds a trailing price in a chunk like "bujía NS 200 a treinta y dos mil" or "aceite $65.000" or "aceite a 65 mil".
 * Returns the text without the price and the price.
 */
export function splitPrice(chunk: string): { text: string; price: number | null } {
  const original = chunk.trim();
  // "$65.000" / "65.000 pesos" / "65000"
  const m1 = /(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:pesos|cop)?\s*$/i.exec(original);
  if (m1) {
    const price = Number(m1[1].replace(/[.,]/g, ""));
    return { text: original.slice(0, m1.index).replace(/\s+(a|en|por|vale|cuesta)\s*$/i, "").trim(), price };
  }
  // "... a treinta y dos mil" / "... en 26 mil" / "... a 26 lucas"
  const words = normalize(original).split(" ");
  let i = words.length - 1;
  while (i >= 0 && isNumberWord(words[i])) i--;
  const numberWords = words.slice(i + 1);
  if (numberWords.length && numberWords.some((w) => w === "mil" || w === "lucas" || w === "millon" || w === "millones" || /^\d{4,}$/.test(w))) {
    const price = parseSpanishNumber(numberWords.join(" "));
    if (price !== null) {
      let head = words.slice(0, i + 1);
      if (["a", "en", "por", "vale", "cuesta", "de"].includes(head[head.length - 1] ?? "")) head = head.slice(0, -1);
      return { text: head.join(" "), price };
    }
  }
  return { text: original, price: null };
}
