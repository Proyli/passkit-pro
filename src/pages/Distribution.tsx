// src/pages/Distribution.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { API } from "@/config/api";
import { useNavigate } from "react-router-dom";

type Settings = {
  enabled: boolean;
  subject: string;
  fromName: string;
  buttonText: string;
  lightBg: string;
  darkBg: string;
  bodyColorLight: string;
  bodyColorDark: string;
  htmlBody: string;
};

type Tier = { id: string; name: string };

const defaultSettings: Settings = {
  enabled: true,
  subject: "Tu tarjeta de lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Guardar en el móvil",
  lightBg: "#143c5c",
  darkBg: "#0f2b40",
  bodyColorLight: "#c69667",
  bodyColorDark: "#0f2b40",
  htmlBody:
    `<p><strong>Estimado cliente,</strong></p>
     <p>Es un honor darle la bienvenida a nuestro exclusivo programa <em>Lealtad Alcazaren</em>…</p>
     <p>Acá está tu nueva tarjeta digital. Toca en <strong>{{BUTTON_TEXT}}</strong> y guárdala en tu billetera móvil.</p>
     <p>Saludos cordiales.<br><strong>Distribuidora Alcazarén</strong></p>`,
};

export default function Distribution() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<Settings>(defaultSettings);
 // Tiers que vienen del backend
const [tiers, setTiers] = useState<Array<{ id: string; name: string }>>([]);

// “Enrollment enabled” por tier
const [enrollment, setEnrollment] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const [previewTheme, setPreviewTheme] =
  useState<'system' | 'light' | 'dark'>('system');


  // 1) Cargar settings y tiers del backend
useEffect(() => {
  (async () => {
    // 1) settings
    try {
      const r1 = await fetch(`${API}/distribution/settings`);
      if (r1.ok) {
        const s = await r1.json();
        setSettings(prev => ({ ...prev, ...s }));
      }
    } catch {}

    // 2) tiers  → crear defaults en enrollment
    try {
      const r2 = await fetch(`${API}/distribution/tiers`);
      const json2 = await r2.json().catch(() => []);
      if (Array.isArray(json2)) {
        setTiers(json2);
        setEnrollment(prev => {
          const out: Record<string, boolean> = { ...prev };
          json2.forEach((t: any) => {
            if (out[t.id] === undefined) out[t.id] = true; // default habilitado
          });
          return out;
        });
      }
    } catch {}

    // 3) enrollment desde el backend  → mezclar encima de lo anterior
    try {
      const r3 = await fetch(`${API}/distribution/enrollment`);
      if (r3.ok) {
        const map = await r3.json().catch(() => ({}));
        setEnrollment(prev => ({ ...prev, ...map })); // <- ¡mezcla!
      }
    } catch {}
  })();
}, []);


  // 2) Ref del iframe que muestra la vista previa
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 3) HTML final para preview (con soporte claro/oscuro)
  const previewHTML = useMemo(() => {
  const btn = settings.buttonText || "Guardar en el móvil";
  const safeBody = String(settings.htmlBody || "")
    .split("{{BUTTON_TEXT}}")
    .join(btn);

  // Colores a usar según la selección
  const bg =
    previewTheme === 'dark'   ? settings.darkBg
  : previewTheme === 'light'  ? settings.lightBg
  :                            settings.lightBg; // system → base light, y luego @media dark

  const screenBg =
    previewTheme === 'dark'   ? settings.bodyColorDark
  : previewTheme === 'light'  ? settings.bodyColorLight
  :                            settings.bodyColorLight;

  // Si el usuario elige "system", dejamos el @media (para simular el SO).
  const darkBlock =
    previewTheme === 'system'
      ? `
  @media (prefers-color-scheme: dark){
    body  { background:${settings.darkBg}; }
    .screen { background:${settings.bodyColorDark}; }
  }`
      : '';

  return `
<!doctype html>
<meta name="color-scheme" content="light dark">
<style>
  :root { color-scheme: light dark; }
  body {
    margin:0; padding:0;
    background:${bg};
    font:16px system-ui, -apple-system, Segoe UI, Roboto;
    color:#fff;
  }
  .wrap{ max-width:400px; margin:0; padding:0 }
  .phone {
    width: 360px; height: 720px; background:#111; border-radius:32px; padding:20px; margin:16px auto;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }
  .screen {
    width:100%; height:100%; border-radius:22px; overflow:auto;
    background:${screenBg};
    padding:20px;
  }
  h2{ margin-top:0 }
  .btn{
    display:inline-block; padding:12px 18px; background:#8b173c; color:#fff;
    border-radius:8px; text-decoration:none; font-weight:600;
  }
  ${darkBlock}
</style>
<body>
  <div class="wrap">
    <div class="phone">
      <div class="screen">
        <h2>Su Tarjeta de Lealtad</h2>
        ${safeBody}
        <p style="margin-top:24px"><a class="btn" href="javascript:void(0)">${btn}</a></p>
      </div>
    </div>
  </div>
</body>
`.trim();
}, [
  settings.htmlBody,
  settings.buttonText,
  settings.lightBg,
  settings.darkBg,
  settings.bodyColorLight,
  settings.bodyColorDark,
  previewTheme,            // << importante
]);


  // 4) Inyectar el HTML en el iframe cada vez que cambie previewHTML
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(previewHTML);
    doc.close();
  }, [previewHTML]);

  // Helpers
  const onChange = (patch: Partial<Settings>) =>
    setSettings((s) => ({ ...s, ...patch }));

 const save = async () => {
  setSaving(true);
  try {
    // 1) guardar settings
    {
      const r = await fetch(`${API}/distribution/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          subject: settings.subject,
          fromName: settings.fromName,
          buttonText: settings.buttonText,
          lightBg: settings.lightBg,
          darkBg: settings.darkBg,
          bodyColorLight: settings.bodyColorLight,
          bodyColorDark: settings.bodyColorDark,
          htmlBody: settings.htmlBody,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
    }

    // 2) guardar enrollment
    {
      const r = await fetch(`${API}/distribution/enrollment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrollment), // <- tu mapa { [tierId]: boolean }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
    }

    toast({ title: "Guardado", description: "Preferencias actualizadas" });
  } catch (e: any) {
    toast({
      title: "No se pudo guardar",
      description: String(e?.message || e),
      variant: "destructive",
    });
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Distribution</h1>
            <p className="text-sm text-muted-foreground">
              Configura el email de bienvenida y los grupos de pases.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => onChange({ enabled: v })}
                id="dist-enabled"
              />
              <Label htmlFor="dist-enabled">Enrollment Enabled</Label>
            </div>

            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

      <div className="hidden md:flex items-center rounded-lg border overflow-hidden">
      {(['light','system','dark'] as const).map(opt => (
        <button
          key={opt}
          onClick={() => setPreviewTheme(opt)}
          className={
            `px-3 py-2 text-sm capitalize ${
              previewTheme === opt ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
            }`
          }
          title={`Preview: ${opt}`}
        >
          {opt}
        </button>
      ))}
    </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario de la izquierda */}
          <Card className="p-5 space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                value={settings.subject}
                onChange={(e) => onChange({ subject: e.target.value })}
              />
            </div>

            <div>
              <Label>From (Sender's Name)</Label>
              <Input
                value={settings.fromName}
                onChange={(e) => onChange({ fromName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email Background (Light)</Label>
                <Input
                  value={settings.lightBg}
                  onChange={(e) => onChange({ lightBg: e.target.value })}
                />
              </div>
              <div>
                <Label>Email Background (Dark)</Label>
                <Input
                  value={settings.darkBg}
                  onChange={(e) => onChange({ darkBg: e.target.value })}
                />
              </div>
              <div>
                <Label>Email Body (Light)</Label>
                <Input
                  value={settings.bodyColorLight}
                  onChange={(e) =>
                    onChange({ bodyColorLight: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email Body (Dark)</Label>
                <Input
                  value={settings.bodyColorDark}
                  onChange={(e) =>
                    onChange({ bodyColorDark: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Button text</Label>
              <Input
                value={settings.buttonText}
                onChange={(e) => onChange({ buttonText: e.target.value })}
              />
            </div>

            <div>
              <Label>Body (HTML)</Label>
              <textarea
                value={settings.htmlBody}
                onChange={(e) => onChange({ htmlBody: e.target.value })}
                className="w-full h-48 rounded-xl border p-3"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tip: usa <code>{'{{BUTTON_TEXT}}'}</code> para insertar el texto
                del botón.
              </p>
            </div>
          </Card>

          {/* Preview a la derecha */}
          <Card className="p-3">
            <iframe
              ref={iframeRef}
              className="w-full h-[720px] rounded-2xl border shadow"
              title="email-preview"
            />
          </Card>
        </div>

      {/* Tiers / Pass groups */}
<div className="mt-8 rounded-2xl bg-white shadow divide-y">
  {tiers.map((t) => (
    <div key={t.id} className="p-4 flex items-center justify-between">
      <div className="min-w-[120px] font-mono text-slate-500">{t.id}</div>
      <div className="flex-1 font-medium">{t.name}</div>

      <div className="flex items-center gap-2">
        {/* Toggle enrollment */}
        <button
          type="button"
          onClick={() =>
            setEnrollment((prev) => ({ ...prev, [t.id]: !prev[t.id] }))
          }
          className={`px-4 h-9 rounded-full text-sm font-medium transition
            ${
              enrollment[t.id]
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          title="Toggle enrollment"
        >
          {enrollment[t.id] ? "ENROLLMENT ENABLED" : "ENROLLMENT DISABLED"}
        </button>

        {/* Share → lleva al Register builder */}
        <button
          type="button"
          onClick={() =>
            navigate(`/designer/register?tier=${encodeURIComponent(t.id)}`)
          }
          className="px-4 h-9 rounded-full border text-sm font-medium hover:bg-slate-50"
          title="Share"
        >
          Share
        </button>
      </div>
    </div>
  ))}
</div>
      </main>
    </div>
  );
}

