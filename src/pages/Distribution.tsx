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


// ================= Types =================
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

const defaultSettings: Settings = {
  enabled: true,
  subject: "Su Tarjeta de Lealtad Alcazaren",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Guardar en el móvil",
  lightBg: "#143c5c",
  darkBg: "#0f2b40",
  bodyColorLight: "#c69667",
  bodyColorDark: "#0f2b40",
  htmlBody: '<!-- CONTENIDO PERSONALIZABLE DEL EMAIL -->\n<p style="margin:0 0 14px 0;font-size:18px;line-height:1.45;">\n  <strong>Su Tarjeta de Lealtad</strong>\n</p>\n\n<p style="margin:0 0 10px 0;line-height:1.6;">\n  Estimado/a <strong>{{DISPLAY_NAME}}</strong>,\n</p>\n\n<p style="margin:0 0 10px 0;line-height:1.6;">\n  Es un honor darle la bienvenida a nuestro exclusivo programa\n  <em>Lealtad Alcazaren</em>, diseñado para premiar su preferencia con beneficios únicos.\n</p>\n\n<p style="margin:0 0 10px 0;line-height:1.6;">\n  A partir de hoy, cada compra de nuestra gama de productos selectos le otorgará\n  ahorros inmediatos y experiencias distinguidas. Acceda fácilmente a sus\n  beneficios desde su billetera digital y disfrute de descuentos exclusivos.\n</p>\n\n<!-- CTA: Botones responsivos y compatibles con Outlook -->\n<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:18px 0 6px 0;">\n  <tr>\n    <td align="center" style="padding:0;">\n      <!--[if mso]>\n      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{GOOGLE_SAVE_URL}}" arcsize="12%" stroke="f" fillcolor="#8B173C" style="height:48px;v-text-anchor:middle;width:320px;">\n        <w:anchorlock/>\n        <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:16px;font-weight:700;">\n          {{BUTTON_TEXT}}\n        </center>\n      </v:roundrect>\n      <![endif]-->\n      <!--[if !mso]><!-- -->\n      <a href="{{GOOGLE_SAVE_URL}}"\n         style="background:#8B173C;border-radius:10px;display:inline-block;padding:14px 22px;text-decoration:none;\n                color:#ffffff;font-weight:700;font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:16px;">\n        {{BUTTON_TEXT}}\n      </a>\n      <!--<![endif]-->\n    </td>\n  </tr>\n</table>\n\n<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 18px 0;">\n  <tr>\n    <td align="center" style="padding:0;">\n      <!--[if mso]>\n      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{APPLE_URL}}" arcsize="12%" strokecolor="#0F2B40" fillcolor="#FFFFFF" style="height:46px;v-text-anchor:middle;width:320px;">\n        <w:anchorlock/>\n        <center style="color:#0F2B40;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:700;">\n          Añadir a Apple Wallet\n        </center>\n      </v:roundrect>\n      <![endif]-->\n      <!--[if !mso]><!-- -->\n      <a href="{{APPLE_URL}}"\n         style="background:#FFFFFF;border:2px solid #0F2B40;border-radius:10px;display:inline-block;padding:12px 20px;text-decoration:none;\n                color:#0F2B40;font-weight:700;font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:15px;">\n        Añadir a Apple Wallet\n      </a>\n      <!--<![endif]-->\n    </td>\n  </tr>\n</table>\n\n<hr style="border:none;border-top:1px solid rgba(0,0,0,.12);margin:18px 0;" />\n\n<p style="margin:0 0 6px 0;line-height:1.6;"><em>Aplican restricciones.</em></p>\n<p style="margin:0 0 6px 0;line-height:1.6;">\n  Si tiene dudas, puede comunicarse al teléfono 2429 5959, ext. 2120 (Ciudad Capital),\n  ext. 1031 (Xelajú) o al correo\n  <a href="mailto:alcazaren@alcazaren.com.gt" style="color:inherit;text-decoration:underline;">alcazaren@alcazaren.com.gt</a>.\n</p>\n\n<p style="margin:14px 0 0 0;line-height:1.6;">\n  Saludos cordiales.<br>\n  <strong>Distribuidora Alcazarén</strong>\n</p>\n<!-- /CONTENIDO PERSONALIZABLE DEL EMAIL -->',

    
};

// Para la tabla de tiers
type Tier = { id: string; name: string };

export default function Distribution() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ================= State =================
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [enrollment, setEnrollment] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"system" | "light" | "dark">("system");

  // 👉 Encabezados para endpoints protegidos (ajusta a tu auth real)
  const ADMIN_GET_HEADERS: Record<string, string> = { "x-role": "admin" };
  const ADMIN_POST_HEADERS: Record<string, string> = {
    "Content-Type": "application/json",
    "x-role": "admin",
  };

  // ================= Effects: cargar settings/tiers/enrollment =================
  useEffect(() => {
    (async () => {
      // 1) Settings (solo admin)
      try {
        const r1 = await fetch(`${API}/distribution/settings`, { headers: ADMIN_GET_HEADERS });
        if (r1.ok) {
          const s = await r1.json();
          setSettings((prev) => ({ ...prev, ...s }));
        }
      } catch {}

      // 2) Tiers (solo admin)
      try {
        const r2 = await fetch(`${API}/distribution/tiers`, { headers: ADMIN_GET_HEADERS });
        const json2: Tier[] = await r2.json().catch(() => [] as Tier[]);
        if (Array.isArray(json2)) {
          setTiers(json2);
          setEnrollment((prev) => {
            const out: Record<string, boolean> = { ...prev };
            json2.forEach((t) => {
              if (out[t.id] === undefined) out[t.id] = true; // default habilitado
            });
            return out;
          });
        }
      } catch {}

      // 3) Enrollment (público en backend; aquí solo mezclamos)
      try {
        const r3 = await fetch(`${API}/distribution/enrollment`);
        if (r3.ok) {
          const map = (await r3.json().catch(() => ({}))) as Record<string, boolean>;
          setEnrollment((prev) => ({ ...prev, ...map }));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================= Preview =================
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewHTML = useMemo(() => {
    const btn = settings.buttonText || "Guardar en el móvil";

    // Reemplazos de PREVIEW (solo visual; el backend inyecta los reales al enviar)
    const SAMPLE: Record<string, string> = {
      DISPLAY_NAME: "Linda Pérez",
      CLIENT: "L01313",
      CAMPAIGN: "C00131",
      BUTTON_TEXT: btn,
      GOOGLE_SAVE_URL: "#google-wallet",
      APPLE_URL: "#apple-wallet",
    };

    const originalBody = String(settings.htmlBody || "");
    let safeBody = originalBody;
    Object.entries(SAMPLE).forEach(([k, v]) => {
      safeBody = safeBody.split(`{{${k}}}`).join(v);
    });

    const hasLinks = originalBody.includes("{{GOOGLE_SAVE_URL}}") || originalBody.includes("{{APPLE_URL}}");
    const fallbackCTA = hasLinks
      ? ""
      : `
        <p style="margin-top:24px"><a class="btn" href="javascript:void(0)">${btn}</a></p>
        <p style="font-size:12px">¿Usa iPhone? <a class="underline" href="javascript:void(0)">Añadir a Apple Wallet</a></p>
      `;

    const bg = previewTheme === "dark" ? settings.darkBg : settings.lightBg;
    const screenBg = previewTheme === "dark" ? settings.bodyColorDark : settings.bodyColorLight;

    const darkBlock =
      previewTheme === "system"
        ? `
  @media (prefers-color-scheme: dark){
    body  { background:${settings.darkBg}; }
    .screen { background:${settings.bodyColorDark}; }
  }`
        : "";

    return `
<!doctype html>
<meta name="color-scheme" content="light dark">
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; background:${bg}; font:16px system-ui,-apple-system,Segoe UI,Roboto; color:#fff; }
  .wrap{ max-width:400px; margin:0; padding:0 }
  .phone{ width:360px; height:720px; background:#111; border-radius:32px; padding:20px; margin:16px auto; box-shadow:0 10px 30px rgba(0,0,0,.35); }
  .screen{ width:100%; height:100%; border-radius:22px; overflow:auto; background:${screenBg}; padding:20px; }
  h2{ margin-top:0 }
  .btn{ display:inline-block; padding:12px 18px; background:#8b173c; color:#fff; border-radius:8px; text-decoration:none; font-weight:600; }
  ${darkBlock}
</style>
<body>
  <div class="wrap">
    <div class="phone">
      <div class="screen">
        <h2>Su Tarjeta de Lealtad</h2>
        ${safeBody}
        ${fallbackCTA}
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
    previewTheme,
  ]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(previewHTML);
    doc.close();
  }, [previewHTML]);

  // ================= Helpers =================
  const onChange = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      // 1) guardar settings
      {
        const r = await fetch(`${API}/distribution/settings`, {
          method: "POST",
          headers: ADMIN_POST_HEADERS,
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
        const j = await r.json().catch(() => ({} as any));
        if (!r.ok || (j && j.ok === false)) throw new Error(j?.error || `HTTP ${r.status}`);
      }

      // 2) guardar enrollment (solo si tu backend lo implementa)
      try {
        const r = await fetch(`${API}/distribution/enrollment`, {
          method: "POST",
          headers: ADMIN_POST_HEADERS,
          body: JSON.stringify(enrollment),
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({} as any));
          if (j && j.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
        }
      } catch (e) {
        console.warn("enrollment POST omitido o no disponible:", String((e as any)?.message || e));
      }

      toast({ title: "Guardado", description: "Preferencias actualizadas" });
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ================= Render =================
  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Distribution</h1>
            <p className="text-sm text-muted-foreground">Configura el email de bienvenida y los grupos de pases.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={settings.enabled} onCheckedChange={(v) => onChange({ enabled: v })} id="dist-enabled" />
              <Label htmlFor="dist-enabled">Enrollment Enabled</Label>
            </div>

            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>

        {/* Theme preview toggles */}
        <div className="hidden md:flex items-center rounded-lg border overflow-hidden">
          {(["light", "system", "dark"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setPreviewTheme(opt)}
              className={`px-3 py-2 text-sm capitalize ${previewTheme === opt ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
              title={`Preview: ${opt}`}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Formulario izquierda */}
          <Card className="p-5 space-y-4">
            <div>
              <Label>Subject</Label>
              <Input value={settings.subject} onChange={(e) => onChange({ subject: e.target.value })} />
            </div>

            <div>
              <Label>From (Sender's Name)</Label>
              <Input value={settings.fromName} onChange={(e) => onChange({ fromName: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email Background (Light)</Label>
                <Input value={settings.lightBg} onChange={(e) => onChange({ lightBg: e.target.value })} />
              </div>
              <div>
                <Label>Email Background (Dark)</Label>
                <Input value={settings.darkBg} onChange={(e) => onChange({ darkBg: e.target.value })} />
              </div>
              <div>
                <Label>Email Body (Light)</Label>
                <Input value={settings.bodyColorLight} onChange={(e) => onChange({ bodyColorLight: e.target.value })} />
              </div>
              <div>
                <Label>Email Body (Dark)</Label>
                <Input value={settings.bodyColorDark} onChange={(e) => onChange({ bodyColorDark: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Button text</Label>
              <Input value={settings.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} />
            </div>

            <div>
              <Label>Body (HTML)</Label>
              <textarea value={settings.htmlBody} onChange={(e) => onChange({ htmlBody: e.target.value })} className="w-full h-48 rounded-xl border p-3" />
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p className="font-medium">Placeholders disponibles:</p>
                <p>
                  <code>{"{{BUTTON_TEXT}}"}</code>, <code>{"{{DISPLAY_NAME}}"}</code>, <code>{"{{CLIENT}}"}</code>, <code>{"{{CAMPAIGN}}"}</code>
                </p>
                <p>Enlaces (opcional, si no los pones el sistema agrega el CTA):</p>
                <p>
                  <code>{"{{GOOGLE_SAVE_URL}}"}</code>, <code>{"{{APPLE_URL}}"}</code>
                </p>
              </div>
            </div>
          </Card>

          {/* Preview derecha */}
          <Card className="p-3">
            <iframe ref={iframeRef} className="w-full h-[720px] rounded-2xl border shadow" title="email-preview" />
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
                  onClick={() => setEnrollment((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                  className={`px-4 h-9 rounded-full text-sm font-medium transition ${
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
                  onClick={() => navigate(`/designer/register?tier=${encodeURIComponent(t.id)}`)}
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
