// src/pages/PassDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PassPreview from "@/components/PassPreview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PassesService } from "@/services/passesService";
import { adaptPass } from "@/lib/adapters";
import type { Pass as UIPass } from "@/types/pass.types";

type PassDetail = UIPass & { [k: string]: any };

export default function PassDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<PassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<PassDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const isGold = () => {
    const bg = String(draft?.backgroundColor || '').toLowerCase();
    const t = String(draft?.title || '').toLowerCase();
    return bg.includes('#daa520') || bg.includes('daa520') || t.includes('gold') || /\b15\b|15%/.test(t);
  };
  const isBlue = () => {
    const bg = String(draft?.backgroundColor || '').toLowerCase();
    const t = String(draft?.title || '').toLowerCase();
    return bg.includes('#2350c6') || bg.includes('2350c6') || bg.includes('#007aff') || bg.includes('007aff') || t.includes('blue') || /\b5\b|5%/.test(t);
  };
  const applyTier = (tier: 'blue' | 'gold') => {
    const color = tier === 'gold' ? '#DAA520' : '#2350C6';
    setDraft(prev => ({ ...(prev || {}), backgroundColor: color, textColor: '#FFFFFF' }));
  };

  async function load() {
    try {
      const raw = await PassesService.get(String(id ?? ""));
      const normalized = adaptPass(raw);
      setData(normalized);
      setDraft(normalized);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const payload: any = {
        title: draft.title,
        description: draft.description,
        type: draft.type,
        backgroundColor: draft.backgroundColor,
        textColor: draft.textColor,
      };
      const updated = await PassesService.update(Number(id), payload);
      const normalized = adaptPass(updated);
      setData(normalized || draft);
      setDraft(normalized || draft);
      setEditMode(false);
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!data) return (
    <div className="p-6 space-y-4">
      <Button variant="outline" onClick={() => nav("/passes")}>← Back</Button>
      <div>No se encontró el pase.</div>
    </div>
  );

  const filteredFields = (() => {
    const raw: any = data?.fields || {};
    const out: Record<string,string> = {};
    Object.entries(raw).forEach(([k,v]) => {
      const key = String(k).toLowerCase();
      if (key.includes('client') || key.includes('codigo') || key.includes('camp')) return; // oculta cliente/campaña
      out[String(k)] = String(v);
    });
    return out;
  })();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => nav("/passes")}>← Back</Button>
        <div className="flex gap-2">
          <Button onClick={() => setEditMode((v) => !v)}>{editMode ? "Cancel" : "Edit"}</Button>
        </div>
      </div>

      <h1 className="text-2xl font-semibold">{(editMode ? draft?.title : data.title) || `Pass #${id}`}</h1>
      {!editMode && <p className="text-gray-600">{data.description || "Sin descripción"}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4 space-y-3">
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Tier quick select</Label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" variant={isBlue() ? 'default' : 'outline'} onClick={() => applyTier('blue')}>Blue 5%</Button>
                  <Button type="button" variant={isGold() ? 'default' : 'outline'} onClick={() => applyTier('gold')}>Gold 15%</Button>
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={draft?.title || ''} onChange={(e) => setDraft({ ...(draft as any), title: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Input value={draft?.type || ''} onChange={(e) => setDraft({ ...(draft as any), type: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input value={draft?.description || ''} onChange={(e) => setDraft({ ...(draft as any), description: e.target.value })} />
              </div>
              <div>
                <Label>Background</Label>
                <Input type="color" value={(draft?.backgroundColor as string) || '#007AFF'} onChange={(e) => setDraft({ ...(draft as any), backgroundColor: e.target.value })} />
              </div>
              <div>
                <Label>Text color</Label>
                <Input type="color" value={(draft?.textColor as string) || '#FFFFFF'} onChange={(e) => setDraft({ ...(draft as any), textColor: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          ) : (
            <div>
              <div><b>Type:</b> {data.type || "-"}</div>
              <div><b>Status:</b> {data.estado || data.status || "active"}</div>
              <div><b>Created:</b> {data.createdAt?.slice?.(0,10) || "-"}</div>
              <div><b>Scans:</b> {data.scans ?? 0}</div>
              <div><b>BG:</b> {data.backgroundColor}</div>
              <div><b>FG:</b> {data.textColor}</div>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-2 font-medium">Card Preview</div>
          <PassPreview passData={{
            title: String((editMode ? draft?.title : data.title) || ''),
            description: String((editMode ? draft?.description : data.description) || ''),
            backgroundColor: String((editMode ? draft?.backgroundColor : data.backgroundColor) || '#007AFF'),
            textColor: String((editMode ? draft?.textColor : data.textColor) || '#FFFFFF'),
            type: String((editMode ? draft?.type : data.type) || 'loyalty'),
            fields: filteredFields,
          }} />
        </div>
      </div>
    </div>
  );
}
