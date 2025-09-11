// backend/services/renderEmail.js
// Plantilla de email con UN solo botón "Añadir a mi Wallet" (smart link).
// Usa {{SMART_URL}} para iOS/Android (redirige a /api/wallet/smart/:token)

const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

// ====== Ajustes por defecto ======
const DEFAULTS = {
  enabled: true,
  subject: "Su Tarjeta de Lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Añadir a mi Wallet",

  // Colores / marca
  lightBg: "#0b1626",
  darkBg:  "#0b1626",
  bodyColorLight: "#f6f5f2",
  bodyColorDark:  "#2b2f3a",
  textLight: "#1f2937",
  textDark:  "#e5e7eb",
  mutedLight: "#6b7280",
  mutedDark:  "#cbd5e1",
  brand: "#8B173C",
  brandText: "#ffffff",

  // Logo por defecto
  logoUrl: process.env.EMAIL_LOGO_URL || "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",

  preheader: "Guarde su tarjeta en su billetera móvil y disfrute beneficios.",

  // Cuerpo HTML (usa placeholders: {{DISPLAY_NAME}}, {{MEMBERSHIP_ID}}, {{SMART_URL}}, {{BUTTON_TEXT}}, {{LOGO_URL}})
  htmlBody: `
<!-- Encabezado -->
<div style="text-align:center; padding:18px 0 8px 0;">
  <img src="{{LOGO_URL}}" width="88" height="88" alt="Alcazarén"
       style="border-radius:999px; border:4px solid rgba(0,0,0,.06); box-shadow:0 4px 16px rgba(0,0,0,.15);">
</div>
<div style="text-align:left; color:#374151; font-size:14px; padding:0 4px 14px 4px;">
  <strong>{{DISPLAY_NAME}}</strong> | <span style="opacity:.9;">MEMBERSHIP ID: {{MEMBERSHIP_ID}}</span>
</div>

<h2 style="margin:0 0 12px 0; font-size:22px; line-height:1.35;">Su Tarjeta de Lealtad</h2>

<p style="margin:0 0 10px 0; line-height:1.7;">
  Bienvenido a <em>Lealtad Alcazarén</em>. Guarde su tarjeta en su billetera digital y acceda a beneficios exclusivos.
</p>

<!-- CTA único (smart link) -->
<div style="margin:22px 0 16px 0; text-align:center;">
  <a href="{{SMART_URL}}"
     style="display:inline-block; padding:12px 22px; border-radius:10px; background:#8B173C; color:#ffffff; text-decoration:none;
            font-weight:700; font-family:Segoe UI,Roboto,Arial,sans-serif; font-size:16px;">
    {{BUTTON_TEXT}}
  </a>
</div>

<p style="margin:10px 0 0 0; font-size:12px; color:#374151;">
  Este es un correo automático. Por favor, no responda a este mensaje.
</p>
`,
};

function mergeSettings(overrides = {}) {
  return { ...DEFAULTS, ...(overrides || {}) };
}

/**
 * Renderiza el HTML del correo.
 * @param {object} settings - Permite sobreescribir DEFAULTS (subject, buttonText, logoUrl, etc.)
 * @param {object} vars - { displayName, membershipId, smartUrl }
 * @returns {string} HTML final
 */
function renderWalletEmail(settings = {}, vars = {}) {
  const s = mergeSettings(settings);

  const displayName  = escapeHtml(vars.displayName || "Cliente");
  const membershipId = escapeHtml(vars.membershipId || "");
  const smartUrl     = vars.smartUrl || "#";
  const logoUrl      = s.logoUrl || DEFAULTS.logoUrl;

  const inner = String(s.htmlBody || "")
    .replace(/{{DISPLAY_NAME}}/g, displayName)
    .replace(/{{MEMBERSHIP_ID}}/g, membershipId)
    .replace(/{{SMART_URL}}/g, smartUrl)
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
