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

function renderWalletEmail(s, { displayName, smartUrl, membershipId }) {
  const buttonText = s.buttonText || 'Añadir a mi Wallet';

  const body = (s.htmlBody || `
    <p style="margin:0 0 16px 0;"><strong>Estimado/a {{DISPLAY_NAME}},</strong></p>
    <p style="margin:0 0 16px 0;">Bienvenido al programa <em>Lealtad Alcazarén</em>. Guarde su tarjeta en su billetera móvil.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="background:#b91c1c;border-radius:8px;padding:12px 18px;">
          <a href="{{SMART_URL}}" style="text-decoration:none;color:#ffffff !important;font-weight:600;display:inline-block;">
            {{BUTTON_TEXT}}
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size:13px;margin:16px 0 0 0;">Si tienes iPhone, el enlace también abrirá Apple Wallet.</p>
  `)
    .replace(/{{DISPLAY_NAME}}/g, escapeHTML(displayName || ''))
    .replace(/{{SMART_URL}}/g, smartUrl)
    .replace(/{{BUTTON_TEXT}}/g, buttonText);

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-collapse:collapse;">
          <tr>
            <td style="padding:24px;font:16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#0f2b40 !important;">
              ${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}


module.exports = { renderWalletEmail, mergeSettings, DEFAULTS };
