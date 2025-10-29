// api.ts
import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // ← usa tu backend
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    console.error("[API ERROR]", {
      url: err?.config?.url,
      method: err?.config?.method,
      status: err?.response?.status,
      data: err?.response?.data,
    });
    return Promise.reject(err);
  }
);