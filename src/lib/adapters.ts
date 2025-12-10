import type { Pass as UIPass } from "@/types/pass.types";

export const adaptPass = (p: any): UIPass => ({
  id: String(p.id ?? p.passId ?? ""),
  title: String(p.title ?? p.titulo ?? p.name ?? "Untitled"),
  type: String(p.type ?? p.tipo ?? "loyalty"),
  description: String(p.description ?? p.descripcion ?? ""),
  backgroundColor: p.backgroundColor ?? p.bgColor ?? undefined,
  textColor: p.textColor ?? p.fgColor ?? undefined,
  createdAt: p.createdAt ?? p.creadoEn ?? p.fechaCreacion ?? undefined,
  scans: typeof p.scans === "number" ? p.scans : undefined,
  status: p.status ?? p.estado ?? "active",
  fields: (() => {
    if (typeof p.fields === "string") {
      try { return JSON.parse(p.fields); } catch { return {}; }
    }
    return p.fields ?? undefined;
  })(),
  member: p.member ?? p.miembro ?? null,
});
