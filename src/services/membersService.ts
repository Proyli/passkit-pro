import { api } from "@/lib/api";

export interface Member {
  id: number;
  external_id: string;
  nombre: string;
  fechaCreacion: string;
  fechaExpiracion?: string | null;
  estado?: "active" | "inactive" | "expired";
}
export type NewMember = Omit<Member, "id">;
export type UpdateMember = Partial<Omit<Member, "id">>;

export const MembersService = {
  list: () => api.get<Member[]>("/api/members").then(r => r.data),
  get: (id: number) => api.get<Member>(`/api/members/${id}`).then(r => r.data),
  create: (payload: NewMember) => api.post<Member>("/api/members", payload).then(r => r.data),
  update: (id: number, payload: UpdateMember) =>
    api.put<Member>(`/api/members/${id}`, payload).then(r => r.data),
  remove: (id: number) => api.delete(`/api/members/${id}`).then(r => r.data),
  removeMany: (ids: number[]) => api.post("/api/members/bulk-delete", { ids }).then(r => r.data),
};
