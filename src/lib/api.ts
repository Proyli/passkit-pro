// src/lib/api.ts

// 1) Base robusta: usa .env si existe; si no, mismo host del front en :3900/api
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") ||
  `${window.location.protocol}//${window.location.hostname}:3900/api`;

// 2) Builder de URL (NO hace fetch)
export const apiUrl = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

// 3) Helper fetch con JSON (si prefieres 1 sola llamada)
export async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  return res;
}

// 4) Lectura de errores (cuando el servidor devuelve HTML o JSON)
export const errorMsg = async (res: Response) => {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j?.message || text;
  } catch {
    return text;
  }
};

// 5) Versión para axios
export const errorMsgAxios = (err: any) => {
  if (err?.response?.data) {
    if (typeof err.response.data === "string") return err.response.data;
    if (err.response.data?.message) return err.response.data.message;
    try { return JSON.stringify(err.response.data); } catch {}
  }
  return err?.message || "Error desconocido";
};
