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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import AddToWalletButton from "@/components/wallet/AddToWalletButton";

type SendArgs = {
  to: string;
  displayName: string;
  clientCode: string;
  campaignCode: string;
  buttonText: string;
  htmlTemplate: string;

  //  nuevos (dinámicos por cliente)
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

function buildUrls(clientCode: string, campaignCode: string) {
  const c = encodeURIComponent(clientCode.trim());
  const k = encodeURIComponent(campaignCode.trim());
  return {
    googleUrl: `${API}/wallet/resolve?client=${c}&campaign=${k}`,
    appleUrl: `${API}/wallet/apple/pkpass?client=${c}&campaign=${k}`, // ajusta si tu backend usa otra ruta
  };
}

async function sendPassEmail(args: SendArgs) {
  const {
    to,
    displayName,
    clientCode,
    campaignCode,
    buttonText,
    htmlTemplate,
    membershipId,   // 👈 nuevo
    logoUrl,        // opcional
    settings,       // opcional
  } = args;

  const { googleUrl, appleUrl } = buildUrls(clientCode, campaignCode);

 const r = await fetch(`${API}/distribution/send-test-email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-role": "admin" },
  body: JSON.stringify({
    to,
    displayName,
    clientCode,
    campaignCode,
    // IMPORTANTE: manda lo que el usuario editó ↓
    settings,           // ← objeto completo (subject, fromName, htmlBody, etc.)
    htmlTemplate,       // ← o solo el HTML si prefieres
    buttonText,
    membershipId,
    logoUrl,
    subject: settings?.subject,
    from: settings?.fromName,
    provider: "outlook", // o "gmail"
  }),
});



  if (!r.ok) {
    const j = await r.json().catch(() => ({} as any));
    throw new Error(j?.error || `HTTP ${r.status}`);
  }
  return r.json();
}


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
  logoUrl?: string;
};

const defaultSettings: Settings = {
  enabled: true,
  subject: "Su Tarjeta de Lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Guardar en el móvil",

  lightBg: "#f5f7fb",
  darkBg: "#0b1626",
  bodyColorLight: "#ffffff",
  bodyColorDark: "#0f2b40",

  // 👇 Un solo botón que usa {{SMART_URL}}
  htmlBody: `
<!-- Encabezado con logo y Membership ID (opcional) -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px 0">
  <tr>
    <td align="left" style="padding:0 0 10px 0">
      <img src="{{LOGO_URL}}" alt="Programa" width="56" height="56"
           style="border-radius:50%;display:block;border:1px solid rgba(0,0,0,.08)" />
    </td>
    <td align="right" style="font:14px/1.4 Segoe UI,Roboto,Arial,sans-serif;color:rgba(0,0,0,.65)">
      <div style="opacity:.8">Membership ID</div>
      <div style="font-weight:700;color:#0F2B40">{{MEMBERSHIP_ID}}</div>
    </td>
  </tr>
</table>

<p style="margin:0 0 14px 0;font-size:18px;line-height:1.45;">
  <strong>Su Tarjeta de Lealtad</strong>
</p>

<p style="margin:0 0 10px 0;line-height:1.6;">
   Estimado/a
  <span style="display:{{SHOW_NAME}};"> <strong>{{DISPLAY_NAME}}</strong>,</span>
</p>

<p style="margin:0 0 10px 0;line-height:1.6;">
  Es un honor darle la bienvenida a nuestro exclusivo programa
  <em>Lealtad Alcazaren</em>, diseñado para premiar su preferencia con beneficios únicos.
</p>

<p style="margin:0 0 10px 0;line-height:1.6;">
  A partir de hoy, cada compra le otorgará ahorros inmediatos y experiencias distinguidas.
  Guarde su tarjeta en la billetera digital y disfrute de descuentos exclusivos.
</p>

<!-- CTA ÚNICO con SMART_URL -->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:18px 0 10px 0;">
  <tr>
    <td align="center" style="padding:0;">
      <a href="{{SMART_URL}}"
         style="background:#8B173C;border-radius:10px;display:inline-block;padding:14px 22px;text-decoration:none;
                color:#ffffff;font-weight:700;font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:16px;">
        {{BUTTON_TEXT}}
      </a>
    </td>
  </tr>
</table>

<hr style="border:none;border-top:1px solid rgba(0,0,0,.12);margin:18px 0;" />

<p style="margin:0 0 6px 0;line-height:1.6;"><em>Aplican restricciones.</em></p>
<p style="margin:0 0 6px 0;line-height:1.6;">
  Si tiene dudas, puede comunicarse al teléfono 2429 5959, ext. 2120 (Ciudad Capital),
  ext. 1031 (Xelajú) o al correo
  <a href="mailto:alcazaren@alcazaren.com.gt" style="color:inherit;text-decoration:underline;">alcazaren@alcazaren.com.gt</a>.
</p>

<p style="margin:14px 0 0 0;line-height:1.6;">
  Saludos cordiales.<br>
  <strong>Distribuidora Alcazarén</strong>
</p>
`,
  logoUrl: "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",
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
  const [clientType, setClientType] = useState<string>(""); // “Tipo de cliente” independiente


  const [testEmail, setTestEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [sending, setSending] = useState(false);
  const [campaignTouched, setCampaignTouched] = useState(false);


  // === Membership ID editable con sugerencia automática ===
const [membershipId, setMembershipId] = useState<string>(() =>
  buildMembershipId(clientCode, campaignCode)
);
const [membershipTouched, setMembershipTouched] = useState(false);

// Recalcular solo si NO ha sido editado manualmente
useEffect(() => {
  if (!membershipTouched) {
    setMembershipId(buildMembershipId(clientCode, campaignCode));
  }
}, [clientCode, campaignCode, membershipTouched]);

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
    DISPLAY_NAME: displayName || "Nombre",
    CLIENT: clientCode || "Codigo Cliente",
    CAMPAIGN: campaignCode || "Codigo Campaña",
    BUTTON_TEXT: btn,
    GOOGLE_SAVE_URL: "#google-wallet",
    APPLE_URL: "#apple-wallet",
    // 👇 añadidos
    MEMBERSHIP_ID: membershipId || "L00005-CP0160",
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
      <p style="font-size:12px">
        ¿Usa iPhone? <a class="underline" href="javascript:void(0)">Añadir a Apple Wallet</a>
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
  membershipId, displayName, clientCode, campaignCode, settings.logoUrl,
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

// === URL para el botón "Guardar en la billetera" ===
const api = import.meta.env.VITE_API_BASE_URL || "/api";
const resolveUrl = useMemo(() => {
  if (!clientCode || !campaignCode) return "";
  return `${api}/wallet/resolve?client=${encodeURIComponent(clientCode)}&campaign=${encodeURIComponent(campaignCode)}`;
}, [api, clientCode, campaignCode]);


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
             logoUrl: settings.logoUrl,    
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

  const canSendTest =
  !!testEmail && !!clientCode.trim() && !!campaignCode.trim() && !!settings.htmlBody.trim();

const handleSendTest = async () => {
  try {
    setSending(true);
    await sendPassEmail({
  to: testEmail,
  displayName: displayName || "Cliente",
  clientCode,
  campaignCode,
  buttonText: settings.buttonText || "Guardar en el móvil",
  htmlTemplate: settings.htmlBody,

  // 👇 añade esto
  membershipId,
  // logoUrl: "https://…/program-logo.png", // opcional
  // settings: settings,                    // opcional (o defaultSettings)
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Formulario izquierda */}
         <Card className="p-5 space-y-3 mt-6">
  <h3 className="text-base font-semibold">Enviar correo de prueba</h3>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {/* Para */}
    <div>
      <Label>Para (email)</Label>
      <Input value={testEmail} onChange={(e)=>setTestEmail(e.target.value)} placeholder="cliente@correo.com" />
    </div>

    {/* Nombre */}
    <div>
      <Label>Nombre (opcional)</Label>
      <Input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Nombre y aopellido" />
    </div>

    {/* Código Cliente */}
    <div>
      <Label>Código Cliente</Label>
      <Input value={clientCode} onChange={(e)=>setClientCode(e.target.value)} placeholder="" />
    </div>

    {/* Código Campaña */}
    <div>
      <Label>Código Campaña</Label>
      <Input
        value={campaignCode}
        onChange={(e)=>{ setCampaignCode(e.target.value); setCampaignTouched(true); }}
        placeholder=""
      />
    </div>
            
    {/* 👇 AQUI VA EL SELECT "Tipo de cliente" */}
    <div>
      <Label>Tipo de cliente</Label>
      <Select
        value={clientType}
        onValueChange={(v)=>{
          setClientType(v);
          if (!campaignTouched) setCampaignCode(v); // sugiere sin pisar si ya escribiste
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

    {/* Membership ID */}
    <div>
      <Label>Membership ID</Label>
      <Input
        value={membershipId}
        onChange={(e)=>{ setMembershipId(e.target.value); setMembershipTouched(true); }}
        placeholder="L00005-CP0160"
      />
      <div className="mt-2">
        <Button
          type="button"
          variant="outline"
          className="h-8"
          onClick={()=>{ setMembershipTouched(false); setMembershipId(buildMembershipId(clientCode, campaignCode)); }}
        >
          Restablecer sugerido
        </Button>
      </div>
    </div>
  </div>

           {/* 👉 Botón para probar la billetera con los códigos actuales */}
  {resolveUrl && (
    <AddToWalletButton resolveUrl={resolveUrl} className="mt-3" />
  )}

  <div className="pt-2">
    <Button onClick={handleSendTest} disabled={!canSendTest || sending}>
      {sending ? "Enviando…" : "Enviar correo de prueba"}
    </Button>
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
