export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export const API_BASE = `${API_URL}/api`;
const TOKEN_KEY = "motatto.token";
const SUPPORT_TOKEN_KEY = "motatto.supportToken";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
  /** Superadmin original token kept while impersonating. */
  getSupport: () => sessionStorage.getItem(SUPPORT_TOKEN_KEY),
  setSupport: (t: string) => sessionStorage.setItem(SUPPORT_TOKEN_KEY, t),
  clearSupport: () => sessionStorage.removeItem(SUPPORT_TOKEN_KEY),
};

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(q?: Query): string {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  return new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? `Error ${res.status}`, err?.details);
}

async function request<T>(method: string, path: string, body?: unknown, opts: { query?: Query; raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs(opts.query)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "NETWORK", "Sin conexión con el servidor. Revisa tu internet.");
  }
  if (!res.ok) throw await parseError(res);
  if (opts.raw) return (await res.blob()) as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  blob: (path: string, query?: Query) => request<Blob>("GET", path, undefined, { query, raw: true }),
  /** multipart upload: fields + one file under `field` */
  upload: <T>(path: string, file: File | Blob, field = "file", extra: Record<string, string> = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    fd.append(field, file, (file as File).name ?? "foto.jpg");
    return request<T>("POST", path, fd);
  },
};

/** Builds an absolute URL for API endpoints that return files (pdf/xlsx). Token goes in query (API accepts it). */
export function apiFileUrl(path: string, query?: Query): string {
  const token = tokenStore.get();
  return `${API_BASE}${path}${qs({ ...(query ?? {}), token: token ?? undefined })}`;
}

/** Resolves possibly-relative upload URLs (local storage mode) against the API origin. */
export function assetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Fotos privadas de R2: se piden a la API con el token de sesión (como los PDF).
  if (url.startsWith("/api/files/")) return apiFileUrl(url.slice("/api".length));
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details as { fieldErrors?: Record<string, string[]> } | Array<{ message?: string }> | undefined;
    if (Array.isArray(d) && d[0]?.message) return `${e.message}: ${d[0].message}`;
    if (d && typeof d === "object" && "fieldErrors" in d && d.fieldErrors) {
      const first = Object.entries(d.fieldErrors)[0];
      if (first) return `${first[0]}: ${first[1][0]}`;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Ocurrió un error inesperado";
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
