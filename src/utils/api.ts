// src/utils/api.ts
import axios from "axios";

// 👉 URL de tu App Service en Azure (fallback seguro)
const BACKEND_FALLBACK = "https://passforge-backend-alcazaren.azurewebsites.net";

// Toma en este orden: VITE_API_URL (build) → window.__API_BASE__ (runtime opcional) → fallback
const baseURL =
  (import.meta as any)?.env?.VITE_API_URL?.trim?.() ||
  (typeof window !== "undefined" && (window as any).__API_BASE__) ||
  BACKEND_FALLBACK;

export const api = axios.create({
  baseURL,
  withCredentials: false,
});

// (opcional) log para verificar en prod una sola vez
if (typeof window !== "undefined" && !(window as any).__API_BASE_LOGGED__) {
  console.log("[api] baseURL =", baseURL);
  (window as any).__API_BASE_LOGGED__ = true;
}

// token si aplica
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
