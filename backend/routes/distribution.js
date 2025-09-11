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
    '<p><strong>Estimado/a {{DISPLAY_NAME}},</strong></p>' +
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
  { htmlTemplate, buttonText, membershipId, logoUrl, subject, from, provider } = {}
) {
  const token = jwt.sign({ client, campaign }, process.env.WALLET_TOKEN_SECRET, { expiresIn: "7d" });
  const smartUrl = `${API_BASE}/api/wallet/smart/${token}`;

  const s = (settings && Object.keys(settings || {}).length)
    ? mergeSettings(settings)
    : { htmlBody: htmlTemplate, buttonText: buttonText || DEFAULT_SETTINGS.buttonText, logoUrl };

  const html = renderWalletEmail(s, { displayName, membershipId, smartUrl });

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
    { provider } // 👈 aquí decides: "gmail" o "outlook"
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
