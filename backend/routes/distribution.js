const express = require("express");
const router = express.Router();
const { pool } = require("../src/db");
const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");

const { renderWalletEmail, mergeSettings } = require("../services/renderEmail");
const { sendMailSmart } = require("../src/mailer");

const API_BASE = process.env.PUBLIC_BASE_URL || "";
const SKIP_DB = process.env.SKIP_DB === "true";

// ---------- Defaults ----------
const DEFAULT_SETTINGS = {
  enabled: true,
  subject: "Tu tarjeta de lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Añadir a mi Wallet",
  lightBg: "#143c5c",
  darkBg: "#0f2b40",
  bodyColorLight: "#c69667",
  bodyColorDark: "#0f2b40",
  htmlBody:
    '<p>Estimado/a' +
      '<span style="display:{{SHOW_NAME}};"> <strong>{{DISPLAY_NAME}}</strong>,</span>' +
    '</p>' +
    '<p>Bienvenido al programa <em>Lealtad Alcazarén</em>. Guarde su tarjeta en su billetera móvil.</p>' +
    '<p><a href="{{SMART_URL}}"><strong>{{BUTTON_TEXT}}</strong></a></p>',
};


// ========== SEND WELCOME: HTML ==========
async function sendWelcomeEmailHtml(
  to,
  displayName,
  client,
  campaign,
  settings,
  { htmlTemplate, buttonText, membershipId, logoUrl, subject, from, provider, tier } = {}
) {
  // Incluir `tier` en el token para que viaje seguro con el smart URL
  const tokenPayload = { client, campaign };
  if (tier) tokenPayload.tier = tier;
  const token = jwt.sign(tokenPayload, process.env.WALLET_TOKEN_SECRET, { expiresIn: "7d" });
  const smartUrl = `${API_BASE}/api/wallet/smart/${token}`;

  // Logging para debug: inputs importantes y token truncado (no exponer key completa)
  try {
    const tshort = String(token || "");
    const tshow = tshort.length > 20 ? `${tshort.slice(0,6)}...${tshort.slice(-6)}` : tshort;
    console.log("[dist] sendWelcomeEmailHtml inputs:", { to, displayName, client, campaign, smartUrl, tokenPreview: tshow });
    console.log("[dist] settings summary:", { hasSettings: !!settings, settingsKeys: Object.keys(settings || {}) });
  } catch (e) {
    console.log("[dist] error logging inputs:", e?.message || e);
  }

  // Mezcla settings del cliente con defaults incluso cuando vienes por htmlTemplate
const s = (settings && Object.keys(settings || {}).length)
  ? mergeSettings(settings)
  : mergeSettings({
      ...DEFAULT_SETTINGS,
      htmlBody: htmlTemplate ?? DEFAULT_SETTINGS.htmlBody,
      buttonText: buttonText || DEFAULT_SETTINGS.buttonText,
      logoUrl,
    });

// Render base
let html = renderWalletEmail(s, { displayName, membershipId, smartUrl });

// Mostrar/ocultar el bloque del nombre (si no hay nombre, no se muestra)
const showName = displayName && String(displayName).trim() ? 'inline' : 'none';

// Reemplazos (compatibles con Node viejito)
html = html
  .replace(/{{SHOW_NAME}}/g, showName)
  .replace(/{{SMART_URL}}/g, smartUrl)       // por si el template usa SMART_URL
  .replace(/{{GOOGLE_SAVE_URL}}/g, smartUrl) // compatibilidad con templates previos
  .replace(/{{APPLE_URL}}/g, smartUrl);



  const result = await sendMailSmart({
    from: from || `${s.fromName || "Alcazaren"} <no-reply@alcazaren.com.gt>`,
    to,
    subject: subject || s.subject || "Su Tarjeta de Lealtad",
    html,
    text: `Añadir a mi Wallet: ${smartUrl}`,
    provider, // 👈 usa "outlook" o "gmail"
  });

  console.log("📬 sendMailSmart result:", result);
  return result;
}

// ========== SEND WELCOME: wrapper para memberController ==========
async function sendWelcomeEmail(memberObj, provider = "outlook") {
  if (!memberObj) return;

  const displayName = `${memberObj.nombre || ""} ${memberObj.apellido || ""}`.trim();

  return sendWelcomeEmailHtml(
    memberObj.email,
    displayName,
    memberObj.codigoCliente,
    memberObj.codigoCampana,
    {}, // settings opcionales
    { provider, tier: memberObj.tipoCliente } // 👈 aquí pasamos el tipoCliente para que el smartUrl incluya ?tier=
  );
}

// ========== TEST EMAIL ==========
router.post("/distribution/send-test-email", async (req, res) => {
  try {
    const {
      email,
      displayName = "",
      clientCode = "",
      campaignCode = "",
      settings = {},
      htmlTemplate,
      buttonText,
      membershipId,
      logoUrl,
      subject,
      from,
      provider,
    } = req.body;

    const result = await sendWelcomeEmailHtml(
      email,
      displayName,
      clientCode,
      campaignCode,
      settings,
      { htmlTemplate, buttonText, membershipId, logoUrl, subject, from, provider }
    );

    res.json({ ok: true, message: `Correo enviado${provider ? " con " + provider : ""}`, result });
  } catch (e) {
    console.error("send-test-email error:", e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});

module.exports = { router, sendWelcomeEmailHtml, sendWelcomeEmail };
