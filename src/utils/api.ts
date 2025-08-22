import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL; // ← del .env

export const api = axios.create({
  baseURL: API_URL,
  // withCredentials: true, // si algún día usas cookies/sesiones
});

export default api;
