const express = require("express");
const router = express.Router();
const { pool } = require("../src/db");
const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");

const { renderWalletEmail, mergeSettings } = require("../services/renderEmail");
const { sendMailSmart } = require("../src/mailer"); // usa Outlook/Gmail con fallback

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

// ========== helpers ==========
function makeSlug() {
  return nanoid(10);
}
function defaultFormForTier(tierId) {
  return {
    tierId,
    slug: makeSlug(),
    enabled: 1,
    title: "Register Below",
    intro: "Necesitamos que ingreses información que garantice el acceso a tu tarjeta de lealtad.",
    buttonText: "REGISTER",
    primaryColor: "#8b173c",
    fields: [
      { name: "nombre", label: "First Name", type: "text", required: true },
      { name: "apellido", label: "Last Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "telefono", label: "Phone", type: "tel", required: false },
    ],
  };
}

// ========== SETTINGS ==========
router.get("/distribution/settings", async (_req, res) => {
  try {
    if (SKIP_DB) return res.json(DEFAULT_SETTINGS);

    await ensureTable();
    const [[row]] = await pool.query(`
      SELECT enabled, subject, from_name AS fromName, button_text AS buttonText,
             light_bg AS lightBg, dark_bg AS darkBg,
             body_color_light AS bodyColorLight, body_color_dark AS bodyColorDark,
             html_body AS htmlBody
      FROM distribution_settings WHERE id=1`);
    res.json(row || DEFAULT_SETTINGS);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e || "settings error") });
  }
});

// ========== SEND WELCOME: HTML ==========
async function sendWelcomeEmailHtml(
  to,
  displayName,
  client,
  campaign,
  settings,
  { htmlTemplate, buttonText, membershipId, logoUrl, subject, from, provider } = {}
) {
  // 1) token + smart URL
  const token = jwt.sign({ client, campaign }, process.env.WALLET_TOKEN_SECRET, { expiresIn: "7d" });
  const smartUrl = `${API_BASE}/api/wallet/smart/${token}`;

  // 2) settings/plantilla
  const s = (settings && Object.keys(settings || {}).length)
    ? mergeSettings(settings)
    : { htmlBody: htmlTemplate, buttonText: buttonText || DEFAULT_SETTINGS.buttonText, logoUrl };

  // 3) Render con smart URL
  const html = renderWalletEmail(
    s,
    { displayName, membershipId, smartUrl }
  );

  // 4) Enviar usando mailer
  return sendMailSmart({
    from: from || `${s.fromName || "Alcazaren"} <no-reply@alcazaren.com.gt>`,
    to,
    subject: subject || s.subject || "Su Tarjeta de Lealtad",
    html,
    text: `Añadir a mi Wallet: ${smartUrl}`, // fallback texto plano
    provider, // 👈 si viene, forzamos (gmail/outlook). Si no, mailer hace fallback
  });
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
      provider, // 👈 opcional
    } = req.body;

    await sendWelcomeEmailHtml(
      email,
      displayName,
      clientCode,
      campaignCode,
      settings,
      { htmlTemplate, buttonText, membershipId, logoUrl, subject, from, provider }
    );

    res.json({ ok: true, message: `Correo enviado${provider ? " con " + provider : ""}` });
  } catch (e) {
    console.error("send-test-email error:", e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});

module.exports = { router, sendWelcomeEmailHtml };
