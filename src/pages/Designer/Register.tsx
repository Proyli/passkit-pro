// src/pages/Designer/Register.tsx
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";

type Field = { name: string; label: string; type: "text" | "email" | "tel"; required?: boolean };
type FormCfg = {
  tierId: string;
  slug: string;
  enabled: boolean;
  title: string;
  intro: string;
  buttonText: string;
  primaryColor: string;
  fields: Field[];
};

export default function DesignerRegister() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [sp] = useSearchParams();
  const tierId = sp.get("tier") || "";

  const [cfg, setCfg] = useState<FormCfg>({
    tierId,
    slug: "",
    enabled: true,
    title: "Register Below",
    intro: "Necesitamos que ingreses información que garantice el acceso a tu tarjeta de lealtad.",
    buttonText: "REGISTER",
    primaryColor: "#8b173c",
    fields: [
      { name: "nombre", label: "First Name", type: "text", required: true },
      { name: "apellido", label: "Last Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
    ],
  });

  useEffect(() => {
    (async () => {
      if (!tierId) return;
      try {
        const { data: j } = await api.get(`/api/distribution/register-config`, { params: { tier: tierId } });
        if (j?.ok) setCfg(j as any);
      } catch {
        /* noop */
      }
    })();
  }, [tierId]);

  const publicUrl = useMemo(() => {
    if (!cfg.slug) return "";
    const base = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/+$/, "");
    return `${base}/register/${cfg.slug}`;
  }, [cfg.slug]);

  const addField = () =>
    setCfg((s) => ({
      ...s,
      fields: [...s.fields, { name: "", label: "", type: "text", required: false }],
    }));

  const save = async () => {
    try {
      const { data: j } = await api.post(`/api/distribution/register-config`, cfg);
      if ((j as any)?.ok === false) throw new Error((j as any)?.error || `Save failed`);
      if ((j as any).slug) setCfg((s) => ({ ...s, slug: (j as any).slug }));
      toast({ title: "Guardado", description: "Registro actualizado" });
    } catch (e: any) {
      toast({ title: "Error", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copiado", description: publicUrl });
  };

  const openForm = () => {
    if (!publicUrl) return;
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => (window.history.length > 1 ? nav(-1) : nav("/designer/distribution"))}
              title="Volver"
            >
              ← Regresar
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Register builder</h1>
              <p className="text-sm text-muted-foreground">Tier: {cfg.tierId || "—"}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={copyLink} disabled={!publicUrl}>
              Share
            </Button>
            <Button variant="outline" onClick={openForm} disabled={!publicUrl}>
              Open form
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config */}
          <Card className="p-5 space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={cfg.title} onChange={(e) => setCfg((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div>
              <Label>Intro</Label>
              <Input value={cfg.intro} onChange={(e) => setCfg((s) => ({ ...s, intro: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Button text</Label>
                <Input
                  value={cfg.buttonText}
                  onChange={(e) => setCfg((s) => ({ ...s, buttonText: e.target.value }))}
                />
              </div>
              <div>
                <Label>Primary color</Label>
                <Input
                  value={cfg.primaryColor}
                  onChange={(e) => setCfg((s) => ({ ...s, primaryColor: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-medium">Fields</h3>
              <Button variant="outline" size="sm" onClick={addField}>
                Add field
              </Button>
            </div>

            <div className="space-y-3">
              {cfg.fields.map((f, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 border rounded-lg p-3">
                  <div className="col-span-3">
                    <Label>Name</Label>
                    <Input
                      value={f.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCfg((s) => {
                          const a = [...s.fields];
                          a[i] = { ...a[i], name: v };
                          return { ...s, fields: a };
                        });
                      }}
                    />
                  </div>
                  <div className="col-span-5">
                    <Label>Label</Label>
                    <Input
                      value={f.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCfg((s) => {
                          const a = [...s.fields];
                          a[i] = { ...a[i], label: v };
                          return { ...s, fields: a };
                        });
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Type</Label>
                    <select
                      className="h-10 w-full rounded-md border px-2"
                      value={f.type}
                      onChange={(e) => {
                        const v = e.target.value as Field["type"];
                        setCfg((s) => {
                          const a = [...s.fields];
                          a[i] = { ...a[i], type: v };
                          return { ...s, fields: a };
                        });
                      }}
                    >
                      <option value="text">text</option>
                      <option value="email">email</option>
                      <option value="tel">tel</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!f.required}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setCfg((s) => {
                            const a = [...s.fields];
                            a[i] = { ...a[i], required: v };
                            return { ...s, fields: a };
                          });
                        }}
                      />
                      Required
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCfg((s) => ({ ...s, fields: s.fields.filter((_, idx) => idx !== i) }))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Preview */}
          <Card className="p-5">
            <div className="mx-auto max-w-md bg-white rounded-2xl shadow p-6">
              <div className="h-10 rounded-xl mb-4" style={{ background: cfg.primaryColor }} />
              <h2 className="text-2xl font-semibold text-center mb-2">{cfg.title}</h2>
              <p className="text-center text-muted-foreground mb-6">{cfg.intro}</p>
              <div className="space-y-3">
                {cfg.fields.map((f, i) => (
                  <Input key={i} placeholder={f.label + (f.required ? " *" : "")} />
                ))}
              </div>
              <Button className="w-full mt-6" style={{ background: cfg.primaryColor }}>
                {cfg.buttonText}
              </Button>
            </div>

            {publicUrl && (
              <p className="text-xs text-muted-foreground mt-3">
                Public link:{" "}
                <a className="font-mono underline" href={publicUrl} target="_blank" rel="noreferrer">
                  {publicUrl}
                </a>
              </p>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
