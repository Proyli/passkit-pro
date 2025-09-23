// src/lib/authz.ts
export type Role = "admin" | "user";
export type Session = { email: string; role: Role; loginTime: string };

export const getSession = (): Session | null => {
  try {
    const raw = localStorage.getItem("passkit_session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && (s.role === "admin" || s.role === "user")) return s as Session;
    return null;
  } catch {
    return null;
  }
};

export const getRole = (): Role => getSession()?.role ?? "user";
export const isAdmin = () => getRole() === "admin";

// permisos simples
export const can = {
  viewMembers: () => true,
  addMember:   () => isAdmin(),
  editMember:  () => isAdmin(),
  deleteMember:() => isAdmin(),
  importExport:() => isAdmin(),
};
