import axios from "axios";

const BACKEND_FALLBACK = "https://passforge-backend-alcazaren.azurewebsites.net";

const baseURL =
  (import.meta as any)?.env?.VITE_API_URL?.trim?.() ||
  (typeof window !== "undefined" && (window as any).__API_BASE__) ||
  BACKEND_FALLBACK;

export const api = axios.create({ baseURL, withCredentials: false });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

if (typeof window !== "undefined" && !(window as any).__API_BASE_LOGGED__) {
  console.log("[api] baseURL =", baseURL);
  (window as any).__API_BASE_LOGGED__ = true;
}
