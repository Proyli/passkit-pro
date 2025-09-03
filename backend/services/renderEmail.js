// backend/services/renderEmail.js
const escapeHtml = (s='') =>
  s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const DEFAULTS = {
  enabled: true,
  subject: "Su Tarjeta de Lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Guardar en el móvil",
  preheader: "Guárdela en su billetera móvil y disfrute de beneficios.",   // 👈 NUEVO
  lightBg: "#f5f7fb",
  darkBg:  "#0b1626",
  bodyColorLight: "#ffffff",
  bodyColorDark:  "#0f2b40",
 htmlBody: `
<p style="margin:0 0 14px 0;font-size:18px;line-height:1.45;">
  <strong>Su Tarjeta de Lealtad</strong>
</p>

<p style="margin:0 0 10px 0;line-height:1.6;">
  Estimado/a <strong>{{DISPLAY_NAME}}</strong>,
</p>

<p style="margin:0 0 10px 0;line-height:1.6;">
  Es un honor darle la bienvenida a nuestro exclusivo programa
  <em>Lealtad Alcazaren</em>, diseñado para premiar su preferencia con beneficios únicos.
</p>

<p style="margin:0 0 10px 0;line-height:1.6;">
  A partir de hoy, cada compra le otorgará ahorros inmediatos y experiencias distinguidas.
  Guarde su tarjeta en la billetera digital y disfrute de descuentos exclusivos.
</p>

<!-- ====== CÓDIGOS INCRUSTADOS (CID) ====== -->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0 6px 0;">
  <tr>
    <td align="center" style="padding:0;">
      <!-- QR opcional (si adjuntas cid:qr) -->
      <img src="cid:qr"
           width="180" height="180" alt="Código QR"
           style="display:inline-block;border-radius:8px;margin:6px;background:#ffffff;padding:8px;" />
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0;">
      <!-- Code128 principal (cid:code128) -->
      <img src="cid:code128"
           alt="Código de barras Code128"
           style="display:block;margin:8px auto 0;width:100%;max-width:520px;background:#ffffff;padding:8px;border-radius:8px;" />
    </td>
  </tr>
</table>
<!-- ====== /CÓDIGOS INCRUSTADOS ====== -->

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:18px 0 6px 0;">
  <tr><td align="center" style="padding:0;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{GOOGLE_SAVE_URL}}" arcsize="12%" stroke="f" fillcolor="#8B173C" style="height:48px;v-text-anchor:middle;width:320px;">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:16px;font-weight:700;">
        {{BUTTON_TEXT}}
      </center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="{{GOOGLE_SAVE_URL}}"
       style="background:#8B173C;border-radius:10px;display:inline-block;padding:14px 22px;text-decoration:none;
              color:#ffffff;font-weight:700;font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:16px;">
      {{BUTTON_TEXT}}
    </a>
    <!--<![endif]-->
  </td></tr>
</table>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 18px 0;">
  <tr><td align="center" style="padding:0;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{APPLE_URL}}" arcsize="12%" strokecolor="#0F2B40" fillcolor="#FFFFFF" style="height:46px;v-text-anchor:middle;width:320px;">
      <w:anchorlock/>
      <center style="color:#0F2B40;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:700;">
        Añadir a Apple Wallet
      </center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="{{APPLE_URL}}"
       style="background:#FFFFFF;border:2px solid #0F2B40;border-radius:10px;display:inline-block;padding:12px 20px;text-decoration:none;
              color:#0F2B40;font-weight:700;font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:15px;">
      Añadir a Apple Wallet
    </a>
    <!--<![endif]-->
  </td></tr>
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
`.trim()
};

function mergeSettings(overrides={}) {
  return { ...DEFAULTS, ...(overrides || {}) };
}

function renderWalletEmail(settings={}, vars={}) {
  const s = mergeSettings(settings);
  const displayName = escapeHtml(vars.displayName || "cliente");
  const googleUrl   = vars.googleUrl || "#";
  const appleUrl    = vars.appleUrl  || "#";
  const inner = (s.htmlBody || "")
    .replace(/{{DISPLAY_NAME}}/g, displayName)
    .replace(/{{GOOGLE_SAVE_URL}}/g, googleUrl)
    .replace(/{{APPLE_URL}}/g, appleUrl)
    .replace(/{{BUTTON_TEXT}}/g, s.buttonText || DEFAULTS.buttonText);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Language" content="es">      
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(s.subject)}</title>
<style>
  .card{background:${s.bodyColorLight};color:#0f172a;}
  @media (prefers-color-scheme: dark) {
    body{background:${s.darkBg}!important;}
    .wrap{background:${s.darkBg}!important;}
    .card{background:${s.bodyColorDark}!important;color:#ffffff!important;}
    a{color:#fff!important;}
  }
</style>
</head>
<body style="margin:0;background:${s.lightBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${s.lightBg};" class="wrap">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;border-radius:18px;padding:24px;" class="card">
        <tr><td style="font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;">
          ${inner}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { renderWalletEmail, mergeSettings, DEFAULTS };
