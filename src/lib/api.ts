// src/lib/api.ts
import axios from "axios";

// Axios centralizado para toda la app
// Base URL se obtiene de Vite (VITE_API_URL). Permite override por window.__API_BASE__.
const FALLBACK_PROD = "https://passforge-backend-alcazaren.azurewebsites.net";
const FALLBACK_DEV = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:3900`
  : "http://localhost:3900";

const envBase = (import.meta as any)?.env?.VITE_API_URL?.toString()?.trim?.();
const runtimeBase = (typeof window !== "undefined" && (window as any).__API_BASE__) as string | undefined;

const baseURL = (envBase || runtimeBase || (import.meta as any).env?.DEV ? FALLBACK_DEV : FALLBACK_PROD) as string;

export const api = axios.create({ baseURL, withCredentials: false });

// Adjunta token si existiera (no obliga a usarlo)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Utilidad para mensajes de error coherentes
export const errorMsgAxios = (err: any) => {
  if (err?.response?.data) {
    if (typeof err.response.data === "string") return err.response.data;
    if (err.response.data?.message) return err.response.data.message;
    try { return JSON.stringify(err.response.data); } catch {}
  }
  return err?.message || "Error desconocido";
};
