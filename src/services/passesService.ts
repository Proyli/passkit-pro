import { api } from "@/utils/api";

export interface Pass {
  id: number;
  tipo: "lealtad" | "cupon" | "evento";
  titulo: string;
  creadoEn: string;
}

export const PassesService = {
  get: (id: string | number) => api.get<Pass>(`/api/passes/${id}`).then(r => r.data),
  list: () => api.get<Pass[]>("/api/passes").then(r => r.data),
  create: (payload: Partial<Pass>) => api.post<Pass>("/api/passes", payload).then(r => r.data),
  update: (id: number, payload: Partial<Pass>) =>
    api.put<Pass>(`/api/passes/${id}`, payload).then(r => r.data),
  remove: (id: number) => api.delete(`/api/passes/${id}`).then(r => r.data),
};
