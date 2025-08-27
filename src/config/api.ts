// src/config/api.ts
const env = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const fallback = `http://${location.hostname}:3900/api`;
export const API = env || fallback;
