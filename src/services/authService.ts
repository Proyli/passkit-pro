import { api } from "@/utils/api";

export interface LoginPayload {
  email: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  user: { id: number; name: string; role: "admin" | "user" };
}

export const AuthService = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>("/api/auth/login", payload).then(r => r.data),

  changePassword: (oldPass: string, newPass: string) =>
    api.post("/api/auth/change-password", { oldPass, newPass }).then(r => r.data),
};
