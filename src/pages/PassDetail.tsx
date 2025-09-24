// src/pages/PassDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";

const API_BASE_PASSES =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  `${window.location.protocol}//${window.location.hostname}:3900/api`;

type PassDetail = {
  id?: string | number;
  title?: string;
  description?: string;
  type?: string;
  estado?: "active" | "inactive" | "expired" | string;
  backgroundColor?: string;
  textColor?: string;
  createdAt?: string;
  scans?: number;
  [k: string]: any;
};

export default function PassDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<PassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await axios.get(`${API_BASE_PASSES}/passes/${id}`);
      setData(res.data || {});
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleDelete() {
    if (!confirm("¿Eliminar este pase?")) return;
    try {
      await axios.delete(`${API_BASE_PASSES}/passes/${id}`);
      nav("/passes");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Error al eliminar");
    }
  }

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!data) return (
    <div className="p-6 space-y-4">
      <Button variant="outline" onClick={() => nav("/passes")}>← Back</Button>
      <div>No se encontró el pase.</div>
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => nav("/passes")}>← Back</Button>
        <div className="flex gap-2">
          <Button onClick={() => nav(`/passes/${id}/edit`)}>Edit</Button>
          <Button variant="outline" onClick={() => window.print()}>Distribute</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </div>

      <h1 className="text-2xl font-semibold">{data.title || `Pass #${id}`}</h1>
      <p className="text-gray-600">{data.description || "Sin descripción"}</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <div><b>Type:</b> {data.type || "-"}</div>
          <div><b>Status:</b> {data.estado || data.status || "active"}</div>
          <div><b>Created:</b> {data.createdAt?.slice?.(0,10) || "-"}</div>
          <div><b>Scans:</b> {data.scans ?? 0}</div>
          <div><b>BG:</b> {data.backgroundColor}</div>
          <div><b>FG:</b> {data.textColor}</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-2 font-medium">Preview</div>
          <div
            className="h-48 rounded-xl flex items-center justify-center text-sm"
            style={{ background: data.backgroundColor || "#f3f4f6", color: data.textColor || "#111827" }}
          >
            {data.title || "Preview"}
          </div>
        </div>
      </div>
    </div>
  );
}
