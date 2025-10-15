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
  preheader: "Guarde su tarjeta digital y disfrute de sus beneficios en segundos.",
  logoUrl: process.env.EMAIL_LOGO_URL || "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",
  lightBg: "#143c5c",
  darkBg: "#0f2b40",
  bodyColorLight: "#c69667",
  bodyColorDark: "#0f2b40",
  htmlBody:
    '<p style="margin:0 0 12px 0;">Estimado/a' +
      '<span style="display:{{SHOW_NAME}};"> <strong>{{DISPLAY_NAME}}</strong></span>,</p>' +
    '<p style="margin:0 0 12px 0;">Bienvenido al programa <em>Lealtad Alcazarén</em>. Guarde su tarjeta en su billetera digital y acceda a todos sus beneficios.</p>' +
    '<p style="margin:0 0 16px 0;"><strong>ID de membresía:</strong> {{MEMBERSHIP_ID}}</p>' +
    '<p style="margin:0 0 20px 0;">Toca el botón para guardar tu tarjeta en segundos.</p>' +
    '<p style="margin:24px 0;text-align:center;">' +
      '<a href="{{SMART_URL}}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#8B173C;color:#ffffff;text-decoration:none;font-weight:600;font-family:Segoe UI,Roboto,Arial,sans-serif;">' +
        '{{BUTTON_TEXT}}' +
      '</a>' +
    '</p>' +
    '<p style="margin:24px 0 0 0;">Saludos cordiales,<br><strong>Distribuidora Alcazarén</strong></p>',
};

const DEFAULT_TIERS = [
  { id: "blue_5", name: "Blue 5%" },
  { id: "gold_15", name: "Gold 15%" },
];

function normalizeSettingsRow(row = {}) {
  return {
    enabled: row.enabled !== undefined ? !!row.enabled : DEFAULT_SETTINGS.enabled,
    subject: row.subject || DEFAULT_SETTINGS.subject,
    fromName: row.fromName || row.from_name || DEFAULT_SETTINGS.fromName,
    buttonText: row.buttonText || row.button_text || DEFAULT_SETTINGS.buttonText,
    lightBg: row.lightBg || row.light_bg || DEFAULT_SETTINGS.lightBg,
    darkBg: row.darkBg || row.dark_bg || DEFAULT_SETTINGS.darkBg,
    bodyColorLight: row.bodyColorLight || row.body_color_light || DEFAULT_SETTINGS.bodyColorLight,
    bodyColorDark: row.bodyColorDark || row.body_color_dark || DEFAULT_SETTINGS.bodyColorDark,
    htmlBody: row.htmlBody || row.html_body || DEFAULT_SETTINGS.htmlBody,
    logoUrl: row.logoUrl || DEFAULT_SETTINGS.logoUrl,
    preheader: row.preheader || DEFAULT_SETTINGS.preheader,
  };
}

async function fetchSettingsFromDb() {
  if (SKIP_DB) return normalizeSettingsRow();
  try {
    const [rows] = await pool.query(
      `SELECT enabled, subject, from_name, button_text, light_bg, dark_bg, body_color_light, body_color_dark, html_body
         FROM distribution_settings
        WHERE id=1
        LIMIT 1`
    );
    if (rows && rows[0]) {
      const row = rows[0];
      row.fromName = row.from_name;
      row.buttonText = row.button_text;
      row.lightBg = row.light_bg;
      row.darkBg = row.dark_bg;
      row.bodyColorLight = row.body_color_light;
      row.bodyColorDark = row.body_color_dark;
      row.htmlBody = row.html_body;
      return normalizeSettingsRow(row);
    }
  } catch (e) {
    console.error("[distribution] fetchSettingsFromDb error:", e?.message || e);
  }
  return normalizeSettingsRow();
}

async function saveSettingsToDb(raw = {}) {
  if (SKIP_DB) {
    console.warn("[distribution] SKIP_DB=true, saveSettingsToDb skipped");
    return { skipped: true };
  }

  const data = normalizeSettingsRow(raw);
  const values = [
    data.enabled ? 1 : 0,
    data.subject,
    data.fromName,
    data.buttonText,
    data.lightBg,
    data.darkBg,
    data.bodyColorLight,
    data.bodyColorDark,
    data.htmlBody,
  ];

  await pool.query(
    `INSERT INTO distribution_settings
       (id, enabled, subject, from_name, button_text, light_bg, dark_bg, body_color_light, body_color_dark, html_body)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled=VALUES(enabled),
       subject=VALUES(subject),
       from_name=VALUES(from_name),
       button_text=VALUES(button_text),
       light_bg=VALUES(light_bg),
       dark_bg=VALUES(dark_bg),
       body_color_light=VALUES(body_color_light),
       body_color_dark=VALUES(body_color_dark),
       html_body=VALUES(html_body)`
    , values
  );
}

async function fetchEnrollmentFromDb() {
  if (SKIP_DB) return {};
  try {
    const [rows] = await pool.query(
      "SELECT tier_id, enabled FROM distribution_enrollment"
    );
    const out = {};
    for (const row of rows || []) {
      if (!row || !row.tier_id) continue;
      out[row.tier_id] = !!row.enabled;
    }
    return out;
  } catch (e) {
    console.error("[distribution] fetchEnrollmentFromDb error:", e?.message || e);
    return {};
  }
}

async function saveEnrollmentToDb(map = {}) {
  if (SKIP_DB || typeof pool.getConnection !== "function") {
    console.warn("[distribution] saveEnrollmentToDb skipped (SKIP_DB or pool without connections)");
    return { skipped: true };
  }

  const entries = Object.entries(map || {}).filter(([tier]) => tier);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM distribution_enrollment");
    if (entries.length) {
      const placeholders = entries.map(() => "(?, ?)").join(",");
      const params = entries.flatMap(([tier, enabled]) => [
        String(tier),
        enabled ? 1 : 0,
      ]);
      await conn.query(
        `INSERT INTO distribution_enrollment (tier_id, enabled) VALUES ${placeholders}`,
        params
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    console.error("[distribution] saveEnrollmentToDb error:", e?.message || e);
    throw e;
  } finally {
    conn.release();
  }
}

function prettifyTierName(id = "") {
  const lower = String(id).toLowerCase();
  if (lower.includes("gold")) return "Gold 15%";
  if (lower.includes("blue")) return "Blue 5%";
  if (lower.includes("silver")) return "Silver";
  return String(id)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchTiers() {
  if (SKIP_DB) return DEFAULT_TIERS;
  const tiers = new Map(DEFAULT_TIERS.map((t) => [t.id, t.name]));
  try {
    const [rows] = await pool.query(
      "SELECT DISTINCT tier_id FROM distribution_enrollment"
    );
    for (const row of rows || []) {
      if (!row || !row.tier_id) continue;
      const id = String(row.tier_id);
      if (!tiers.has(id)) tiers.set(id, prettifyTierName(id));
    }
  } catch (e) {
    console.warn("[distribution] fetchTiers warning:", e?.message || e);
  }
  return Array.from(tiers.entries()).map(([id, name]) => ({ id, name }));
}

router.get("/distribution/settings", async (_req, res) => {
  try {
    const settings = await fetchSettingsFromDb();
    res.json(settings);
  } catch (e) {
    console.error("[distribution] settings GET error:", e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});

router.post("/distribution/settings", async (req, res) => {
  try {
    const incoming = req.body || {};
    await saveSettingsToDb(incoming);
    const fresh = await fetchSettingsFromDb();
    const merged = normalizeSettingsRow({ ...fresh, ...incoming });
    res.json({ ok: true, settings: merged });
  } catch (e) {
    console.error("[distribution] settings POST error:", e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});

router.get("/distribution/enrollment", async (_req, res) => {
  try {
    const map = await fetchEnrollmentFromDb();
    res.json(map);
  } catch (e) {
    console.error("[distribution] enrollment GET error:", e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});

router.post("/distribution/enrollment", async (req, res) => {
  try {
    await saveEnrollmentToDb(req.body || {});
    res.json({ ok: true });
  } catch (e) {
    console.error("[distribution] enrollment POST error:", e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});

router.get("/distribution/tiers", async (_req, res) => {
  try {
    const tiers = await fetchTiers();
    res.json(tiers);
  } catch (e) {
    console.error("[distribution] tiers GET error:", e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});


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
if (buttonText) s.buttonText = buttonText;
if (logoUrl) s.logoUrl = logoUrl;

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
  const membershipId = memberObj.external_id || memberObj.externalId || memberObj.codigoCliente || "";

  const settings = await fetchSettingsFromDb();
  // Enviar siempre desde el flujo de Perfil (aunque settings.enabled sea false)
  // Deja rastro en logs por si el admin desactiva temporalmente la distribución.
  if (settings && settings.enabled === false) {
    console.warn("[dist] settings.enabled=false -> override (perfil). Enviando a", memberObj.email);
  }

  return sendWelcomeEmailHtml(
    memberObj.email,
    displayName,
    memberObj.codigoCliente,
    memberObj.codigoCampana,
    settings || {},
    { provider, tier: memberObj.tipoCliente, membershipId }
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
