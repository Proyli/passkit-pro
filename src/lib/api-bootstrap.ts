// src/lib/api-bootstrap.ts
import axios from "axios";
import { API_BASE } from "@/lib/api";

// Base para todas las llamadas axios (get/post/put/delete…)
axios.defaults.baseURL = API_BASE;

// Prefijos de rutas que SON del backend (para no tocar assets del front)
const API_PREFIXES = [
  "members",
  "passes",
  "cards",
  "designs",
  "barcodes",
  "csv",
  "auth",
];

// ¿La URL apunta a una ruta de API conocida?
const isApiPath = (url: string) => {
  const first = (url.replace(/^\//, "").split(/[/?#]/)[0] || "").toLowerCase();
  return API_PREFIXES.includes(first);
};

// Parche de fetch: si la URL no es absoluta y parece de API → la mandamos al API_BASE
const _fetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  let url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : String(input as any);

  // Ya es absoluta (http/https) → no tocamos
  if (/^https?:\/\//i.test(url)) {
    return _fetch(input, init);
  }

  // Solo reescribimos rutas que parecen API (evita romper assets del front)
  if (isApiPath(url)) {
    const path = url.startsWith("/") ? url : `/${url}`;
    const absolute = `${API_BASE}${path}`;
    return _fetch(absolute, init);
  }

  // Para cualquier otra cosa (assets del front, etc.) → intacto
  return _fetch(input, init);
};
