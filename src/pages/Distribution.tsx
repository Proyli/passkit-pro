// src/pages/Distribution.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import HtmlEditor from "@/components/forms/HtmlEditor";
import { useToast } from "@/hooks/use-toast";
import { API } from "@/config/api";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type SendArgs = {
  to: string;
  displayName: string;
  clientCode: string;
  campaignCode: string;
  buttonText: string;
  htmlTemplate: string;

  // Campos opcionales para personalizar el correo
  membershipId?: string;     // p.ej. "L00005-CP0160"
  logoUrl?: string;          // si quieres forzar el logo del correo
  settings?: Settings;       // si deseas enviar TODO el look desde el front
};

// Sugerir "L00005-CP0160" a partir de clientCode/campaignCode
function buildMembershipId(clientCode: string, campaignCode: string) {
  const num = String(clientCode ?? "").replace(/\D/g, "");
  const padded = num ? num.padStart(5, "0") : String(clientCode ?? "");
  const cleanCamp = String(campaignCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const camp = cleanCamp.startsWith("CP") ? cleanCamp : (cleanCamp ? `CP${cleanCamp}` : "");
  return `L${padded}${camp ? `-${camp}` : ""}`;
}

async function sendPassEmail(args: SendArgs) {
  const {
    to,
    displayName,
    clientCode,
    campaignCode,
    buttonText,
    htmlTemplate,
    membershipId,
    logoUrl,
    settings,
  } = args;

  const response = await fetch(`${API}/distribution/send-test-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-role": "admin" },
    body: JSON.stringify({
      to,
      displayName,
      clientCode,
      campaignCode,
      settings,
      htmlTemplate,
      buttonText,
      membershipId,
      logoUrl,
      subject: settings?.subject,
      from: settings?.fromName,
      provider: "outlook", // o "gmail"
    }),
  });

  let payload: any = {};
  try {
    payload = await response.json();
  } catch (_err) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload;
}
// ================= Types =================
type Settings = {
  enabled: boolean;
  subject: string;
  fromName: string;
  preheader: string;
  buttonText: string;
  lightBg: string;
  darkBg: string;
  bodyColorLight: string;
  bodyColorDark: string;
  htmlBody: string;
  logoUrl?: string;
};

const defaultSettings: Settings = {
  enabled: true,
  subject: "Su Tarjeta de Lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  preheader: "Guarde su tarjeta digital y disfrute de sus beneficios.",
  buttonText: "Guardar en el móvil",

  lightBg: "#f5f7fb",
  darkBg: "#0b1626",
  bodyColorLight: "#ffffff",
  bodyColorDark: "#0f2b40",

  // 👇 Un solo botón que usa {{SMART_URL}}
  htmlBody: `
<p style="margin:0 0 12px 0;">Estimado/a<span style="display:{{SHOW_NAME}};"> <strong>{{DISPLAY_NAME}}</strong></span>,</p>
<p style="margin:0 0 12px 0;">Bienvenido al programa <em>Lealtad Alcazarén</em>. Guarde su tarjeta en su billetera digital y acceda a todos sus beneficios.</p>
<p style="margin:0 0 20px 0;">Toca el botón para guardar tu tarjeta en segundos.</p>
<p style="margin:24px 0;text-align:center;">
  <a href="{{SMART_URL}}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#8B173C;color:#ffffff;text-decoration:none;font-weight:600;font-family:Segoe UI,Roboto,Arial,sans-serif;">
    {{BUTTON_TEXT}}
  </a>
</p>
<p style="margin:24px 0 0 0;">Saludos cordiales,<br><strong>Distribuidora Alcazarén</strong></p>
`,
  logoUrl: "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",
};



export default function Distribution() {
  const { toast } = useToast();

  // ================= State =================
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"system" | "light" | "dark">("system");
  const [clientType, setClientType] = useState<string>(""); // “Tipo de cliente” independiente


  const [testEmail, setTestEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [sending, setSending] = useState(false);
  const [campaignTouched, setCampaignTouched] = useState(false);

  const PLACEHOLDERS = [
    "{{DISPLAY_NAME}}",
    "{{SHOW_NAME}}",
    "{{BUTTON_TEXT}}",
    "{{SMART_URL}}",
    "{{LOGO_URL}}",
  ];

  // === Membership ID editable con sugerencia automática ===
// Eliminado del UI: Membership ID se mostrará solo en la tarjeta/código de barras.

  // 👉 Encabezados para endpoints protegidos (ajusta a tu auth real)
  const ADMIN_GET_HEADERS: Record<string, string> = { "x-role": "admin" };
  const ADMIN_POST_HEADERS: Record<string, string> = {
    "Content-Type": "application/json",
    "x-role": "admin",
  };

  // ================= Effects: cargar settings =================
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================= Preview =================
  const iframeRef = useRef<HTMLIFrameElement>(null);

 const previewHTML = useMemo(() => {
  const btn = settings.buttonText || "Guardar en el móvil";

  // Reemplazos de PREVIEW (solo visual; el backend inyecta los reales al enviar)
  const SAMPLE: Record<string, string> = {
    DISPLAY_NAME: displayName || "Nombre",
    CLIENT: clientCode || "Codigo Cliente",
    CAMPAIGN: campaignCode || "Codigo Campaña",
    BUTTON_TEXT: btn,
    SHOW_NAME: displayName ? "inline" : "none",
    GOOGLE_SAVE_URL: "#google-wallet",
    APPLE_URL: "#apple-wallet",
    LOGO_URL: settings.logoUrl || "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",
   SMART_URL: "#smart-url",
  };

  const originalBody = String(settings.htmlBody || "");
  let safeBody = originalBody;
  Object.entries(SAMPLE).forEach(([k, v]) => {
    safeBody = safeBody.split(`{{${k}}}`).join(v);
  });

  const hasLinks = originalBody.includes("{{SMART_URL}}");

const fallbackCTA = hasLinks
  ? ""
  : `
      <p style="margin-top:24px">
        <a class="btn" href="javascript:void(0)">${btn}</a>
      </p>
    `;

  const bg = previewTheme === "dark" ? settings.darkBg : settings.lightBg;
const screenBg = previewTheme === "dark" ? settings.bodyColorDark : settings.bodyColorLight;
const screenText = previewTheme === "dark" ? "#ffffff" : "#0F2B40"; // 👈 texto legible

const darkBlock =
  previewTheme === "system"
    ? `
@media (prefers-color-scheme: dark){
  body  { background:${settings.darkBg}; }
  .screen { background:${settings.bodyColorDark}; color:#ffffff; }
}`
    : "";

return `
<!doctype html>
<meta name="color-scheme" content="light dark">
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; background:${bg}; font:16px system-ui,-apple-system,Segoe UI,Roboto,Arial; }
  .wrap{ max-width:400px; margin:0; padding:0 }
  .phone{ width:360px; height:720px; background:#111; border-radius:32px; padding:20px; margin:16px auto; box-shadow:0 10px 30px rgba(0,0,0,.35); }
  .screen{ width:100%; height:100%; border-radius:22px; overflow:auto; background:${screenBg}; color:${screenText}; padding:20px; }
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
  // 👇 asegúrate de volver a renderizar cuando cambie:
  displayName, clientCode, campaignCode, settings.logoUrl,
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
            preheader: settings.preheader,
            buttonText: settings.buttonText,
            lightBg: settings.lightBg,
            darkBg: settings.darkBg,
            bodyColorLight: settings.bodyColorLight,
            bodyColorDark: settings.bodyColorDark,
            htmlBody: settings.htmlBody,
            logoUrl: settings.logoUrl,
          }),
        });
        const j = await r.json().catch(() => ({} as any));
        if (!r.ok || (j && j.ok === false)) throw new Error(j?.error || `HTTP ${r.status}`);
      }

      toast({ title: "Guardado", description: "Preferencias actualizadas" });
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const trimmedEmail = testEmail.trim();
  const canSendTest =
    !!trimmedEmail && !!clientCode.trim() && !!campaignCode.trim() && !!settings.htmlBody.trim();

const handleSendTest = async () => {
  try {
    setSending(true);
    await sendPassEmail({
      to: trimmedEmail,
      displayName: displayName || "Cliente",
      clientCode,
      campaignCode,
      buttonText: settings.buttonText || "Guardar en el móvil",
      htmlTemplate: settings.htmlBody,
      logoUrl: settings.logoUrl,
      settings,
    });

    toast({ title: "Enviado", description: "Correo de bienvenida enviado." });
  } catch (e: any) {
    toast({ title: "Error al enviar", description: String(e?.message || e), variant: "destructive" });
  } finally {
    setSending(false);
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

        {/* Configuración del contenido */}
        <Card className="mt-6 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-base font-semibold">Contenido del correo</h3>
            <span className="text-xs text-muted-foreground">
              Placeholders disponibles: {PLACEHOLDERS.join(", ")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Asunto</Label>
              <Input
                value={settings.subject}
                onChange={(e) => onChange({ subject: e.target.value })}
                placeholder="Su Tarjeta de Lealtad"
              />
            </div>
            <div>
              <Label>Remitente</Label>
              <Input
                value={settings.fromName}
                onChange={(e) => onChange({ fromName: e.target.value })}
                placeholder="Distribuidora Alcazarén, S. A."
              />
            </div>
            <div>
              <Label>Preheader</Label>
              <Input
                value={settings.preheader}
                onChange={(e) => onChange({ preheader: e.target.value })}
                placeholder="Guarde su tarjeta en la billetera móvil."
              />
            </div>
            <div>
              <Label>Texto del botón</Label>
              <Input
                value={settings.buttonText}
                onChange={(e) => onChange({ buttonText: e.target.value })}
                placeholder="Guardar en el móvil"
              />
            </div>
            <div>
              <Label>Logo (URL opcional)</Label>
              <Input
                value={settings.logoUrl || ""}
                onChange={(e) => onChange({ logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <Label>HTML del correo</Label>
            <HtmlEditor
              value={settings.htmlBody}
              onChange={(html) => onChange({ htmlBody: html })}
              placeholders={PLACEHOLDERS}
              placeholder="Escribe el contenido del correo y usa la barra de herramientas para darle formato"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label>Fondo claro</Label>
              <Input
                type="color"
                value={settings.lightBg}
                onChange={(e) => onChange({ lightBg: e.target.value })}
              />
            </div>
            <div>
              <Label>Fondo oscuro</Label>
              <Input
                type="color"
                value={settings.darkBg}
                onChange={(e) => onChange({ darkBg: e.target.value })}
              />
            </div>
            <div>
              <Label>Cuerpo (claro)</Label>
              <Input
                type="color"
                value={settings.bodyColorLight}
                onChange={(e) => onChange({ bodyColorLight: e.target.value })}
              />
            </div>
            <div>
              <Label>Cuerpo (oscuro)</Label>
              <Input
                type="color"
                value={settings.bodyColorDark}
                onChange={(e) => onChange({ bodyColorDark: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Formulario izquierda */}
        <Card className="p-5 space-y-3 mt-6">
          <h3 className="text-base font-semibold">Enviar correo</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Para (email)</Label>
              <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="cliente@correo.com" />
            </div>

            <div>
              <Label>Nombre (opcional)</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nombre y apellido" />
            </div>

            <div>
              <Label>Código Cliente</Label>
              <Input value={clientCode} onChange={(e) => setClientCode(e.target.value)} placeholder="" />
            </div>

            <div>
              <Label>Código Campaña</Label>
              <Input
                value={campaignCode}
                onChange={(e) => {
                  setCampaignCode(e.target.value);
                  setCampaignTouched(true);
                }}
                placeholder=""
              />
            </div>

            <div>
              <Label>Tipo de cliente</Label>
              <Select
                value={clientType}
                onValueChange={(v) => {
                  setClientType(v);
                  if (!campaignTouched) setCampaignCode(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione un tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue_5">Blue 5%</SelectItem>
                  <SelectItem value="gold_15">Gold 15%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Membership ID oculto en Distribution */}
          </div>

          <div className="pt-2">
            <Button onClick={handleSendTest} disabled={!canSendTest || sending}>
              {sending ? "Enviando…" : "Enviar correo"}
            </Button>
          </div>
        </Card>



          {/* Preview derecha */}
          <Card className="p-3">
            <iframe ref={iframeRef} className="w-full h-[720px] rounded-2xl border shadow" title="email-preview" />
          </Card>
        </div>

      </main>
    </div>
  );
}



