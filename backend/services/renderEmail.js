// backend/services/renderEmail.js

const escapeHtml = (s = "") =>
  s.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

// ====== Tema estilo PassKit ======
const DEFAULTS = {
  enabled: true,
  subject: "Su Tarjeta de Lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Guardar en el móvil",

  // Colores (ajusta si quieres otro tono)
  lightBg: "#0b1626",        // fondo de página (oscuro azul petróleo como en tu header)
  darkBg:  "#0b1626",
  bodyColorLight: "#c99264", // color arena de la tarjeta
  bodyColorDark:  "#2b2f3a", // tarjeta en oscuro
  textLight: "#1f2937",      // slate-700 (texto sobre arena)
  textDark:  "#e5e7eb",      // slate-200
  mutedLight: "#6b7280",     // slate-500
  mutedDark:  "#cbd5e1",

  brand: "#8B173C",
  brandText: "#ffffff",

  // Logo por defecto (puedes sobrescribir vía settings.logoUrl)
  logoUrl: process.env.EMAIL_LOGO_URL || "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",

  preheader: "Guarde su tarjeta en su billetera móvil y disfrute beneficios.",

  // Usa: {{DISPLAY_NAME}}, {{MEMBERSHIP_ID}}, {{GOOGLE_SAVE_URL}}, {{APPLE_URL}}, {{BUTTON_TEXT}}, {{LOGO_URL}}
  htmlBody: `
<!-- Encabezado: logo centrado y barra superior -->
<div style="text-align:center; padding:18px 0 8px 0;">
  <img src="{{LOGO_URL}}" width="88" height="88" alt="Alcazarén" style="border-radius:999px; border:4px solid rgba(255,255,255,.15);">
</div>
<div style="text-align:left; color:#cbd5e1; font-size:14px; padding:0 4px 14px 4px;">
  <strong>{{DISPLAY_NAME}}</strong> | <span style="opacity:.9;">MEMBERSHIP ID: {{MEMBERSHIP_ID}}</span>
</div>

<h2 style="margin:0 0 12px 0; font-size:22px; line-height:1.35;">Su Tarjeta de Lealtad</h2>

<p style="margin:0 0 10px 0; line-height:1.6;"><strong>Estimado cliente,</strong></p>

<p style="margin:0 0 10px 0; line-height:1.7;">
  Es un honor darle la bienvenida a nuestro exclusivo programa <em>Lealtad Alcazarén</em>,
  diseñado para premiar su preferencia con beneficios únicos.
</p>

<p style="margin:0 0 10px 0; line-height:1.7;">
  A partir de hoy, cada compra de nuestra gama de productos selectos le otorgará ahorros inmediatos y experiencias distinguidas.
</p>

<p style="margin:0 0 14px 0; line-height:1.7;">
  Acceda fácilmente a sus beneficios desde su billetera digital (Apple Wallet o Google Wallet) y disfrute de descuentos exclusivos.
</p>

<p style="margin:0 0 14px 0; line-height:1.7;">
  Gracias por confiar en nosotros; su lealtad merece siempre lo mejor.
</p>

<p style="margin:10px 0 16px 0; font-size:13px; opacity:.9;"><em>Aplican restricciones.</em></p>

<!-- CTA principal (Google) -->
<div style="margin:22px 0 10px 0; text-align:center;">
  <a href="{{GOOGLE_SAVE_URL}}"
     style="display:inline-block; padding:12px 22px; border-radius:10px; background:#8B173C; color:#ffffff; text-decoration:none;
            font-weight:700; font-family:Segoe UI,Roboto,Arial,sans-serif; font-size:16px;">
    {{BUTTON_TEXT}}
  </a>
</div>

<!-- CTA secundario (Apple) -->
<div style="margin:8px 0 8px 0; text-align:center;">
  <a href="{{APPLE_URL}}"
     style="display:inline-block; padding:12px 20px; border-radius:10px; background:#111827; color:#ffffff; text-decoration:none;
            font-weight:700; font-family:Segoe UI,Roboto,Arial,sans-serif; font-size:15px;">
    Añadir a Apple Wallet
  </a>
</div>

<p style="margin:14px 0 0 0; font-size:12px; color:#111827;">
  Este es un correo automático. Por favor, no responda a este mensaje.
</p>
`,
};

function mergeSettings(overrides = {}) {
  return { ...DEFAULTS, ...(overrides || {}) };
}

function renderWalletEmail(settings = {}, vars = {}) {
  const s = mergeSettings(settings);

  const displayName   = escapeHtml(vars.displayName || "cliente");
  const membershipId  = escapeHtml(vars.membershipId || "");
  const googleUrl     = vars.googleUrl || "#";
  const appleUrl      = vars.appleUrl  || "#";
  const logoUrl       = s.logoUrl || DEFAULTS.logoUrl;

  const inner = (s.htmlBody || "")
    .replace(/{{DISPLAY_NAME}}/g, displayName)
    .replace(/{{MEMBERSHIP_ID}}/g, membershipId)
    .replace(/{{GOOGLE_SAVE_URL}}/g, googleUrl)
    .replace(/{{APPLE_URL}}/g, appleUrl)
    .replace(/{{BUTTON_TEXT}}/g, s.buttonText || DEFAULTS.buttonText)
    .replace(/{{LOGO_URL}}/g, logoUrl);

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${s.subject}</title>
  <style>
    table, td { border-collapse: collapse; }
    img { border: 0; display: block; }
    .pre { display:none!important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all; }
    .txt { font-family: Segoe UI, Roboto, Arial, sans-serif; }
    @media (prefers-color-scheme: dark) {
      .wrap { background: ${s.darkBg} !important; }
      .card { background: ${s.bodyColorDark} !important; color: ${s.textDark} !important; }
      .muted { color: ${s.mutedDark} !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:${s.lightBg};">
  <div class="pre">${s.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrap" style="background:${s.lightBg};">
    <tr>
      <td align="center" style="padding:18px 12px;">
        <table role="presentation" width="680" cellpadding="0" cellspacing="0" class="card"
               style="max-width:680px; width:100%; background:${s.bodyColorLight}; border-radius:12px; padding:22px;">
          <tr>
            <td class="txt" style="font-size:16px; line-height:1.6; color:${s.textLight};">
              ${inner}
            </td>
          </tr>
        </table>
        <div class="txt muted" style="font-size:12px; color:${s.mutedLight}; margin-top:12px;">
          © Alcazarén — Todos los derechos reservados
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderWalletEmail, mergeSettings, DEFAULTS };
