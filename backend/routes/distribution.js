// backend/routes/distribution.js
const express = require("express");
const router = express.Router();
const { pool } = require("../src/db");
const nodemailer = require("nodemailer");
const { nanoid } = require("nanoid");
const fetch = require("node-fetch"); // npm i node-fetch@2
const { renderWalletEmail, mergeSettings } = require("../services/renderEmail");

const API_BASE = process.env.PUBLIC_BASE_URL || ""; // para links absolutos
const SKIP_DB = process.env.SKIP_DB === "true";

// ---------- SMTP (para futuros usos locales; hoy delegamos al /wallet/send) ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMPP_USER || process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
async function sendWelcomeEmail({ to, displayName, googleUrl, appleUrl, settings }) {
  const s = mergeSettings(settings);
  const html = renderWalletEmail(s, { displayName, googleUrl, appleUrl });

  return transporter.sendMail({
    from: `"${s.fromName}" <no-reply@alcazaren.com.gt>`,
    to,
    subject: s.subject,
    html,                           //  usar HTML
    text: `Guarde su tarjeta: ${googleUrl}` // fallback de texto
  });
}

// ---------- Defaults cuando no hay DB ----------
const DEFAULT_SETTINGS = {
  enabled: true,
  subject: "Tu tarjeta de lealtad",
  fromName: "Distribuidora Alcazarén, S. A.",
  buttonText: "Guardar en el móvil",
  lightBg: "#143c5c",
  darkBg: "#0f2b40",
  bodyColorLight: "#c69667",
  bodyColorDark: "#0f2b40",
  htmlBody:
    '<p><strong>Estimado/a {{DISPLAY_NAME}},</strong></p>' +
    '<p>Bienvenido al programa <em>Lealtad Alcazaren</em>. Guarde su tarjeta en su billetera móvil.</p>' +
    '<p><a href="{{GOOGLE_SAVE_URL}}"><strong>{{BUTTON_TEXT}}</strong></a></p>' +
    '<p style="font-size:13px">¿Usa iPhone? <a href="{{APPLE_URL}}">Añadir a Apple Wallet</a></p>',
};

// ---------- DB bootstrap ----------
async function ensureTable() {
  if (SKIP_DB) return; // en Render sin DB: no crear nada

  await pool.query(`
    CREATE TABLE IF NOT EXISTS distribution_settings (
      id TINYINT PRIMARY KEY DEFAULT 1,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      subject VARCHAR(200) NOT NULL,
      from_name VARCHAR(200) NOT NULL,
      button_text VARCHAR(80) NOT NULL,
      light_bg VARCHAR(16) NOT NULL,
      dark_bg VARCHAR(16) NOT NULL,
      body_color_light VARCHAR(16) NOT NULL,
      body_color_dark VARCHAR(16) NOT NULL,
      html_body MEDIUMTEXT NOT NULL
    )
  `);

  const [exists] = await pool.query(`SELECT id FROM distribution_settings WHERE id=1`);
  if (exists.length === 0) {
    await pool.query(
      `INSERT INTO distribution_settings
       (id, enabled, subject, from_name, button_text, light_bg, dark_bg, body_color_light, body_color_dark, html_body)
       VALUES (1, 1, 'Tu tarjeta de lealtad', 'Distribuidora Alcazarén, S. A.', 'Guardar en el móvil',
               '#143c5c', '#0f2b40', '#c69667', '#0f2b40',
               '<p><strong>Estimado/a {{DISPLAY_NAME}},</strong></p><p>Bienvenido al programa <em>Lealtad Alcazaren</em>. Guarde su tarjeta en su billetera móvil.</p><p><a href=\"{{GOOGLE_SAVE_URL}}\"><strong>{{BUTTON_TEXT}}</strong></a></p><p style=\"font-size:13px\">¿Usa iPhone? <a href=\"{{APPLE_URL}}\">Añadir a Apple Wallet</a></p>')`
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS registration_forms (
      tier_id VARCHAR(64) PRIMARY KEY,
      slug VARCHAR(64) NOT NULL UNIQUE,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      title VARCHAR(200) NOT NULL,
      intro MEDIUMTEXT NOT NULL,
      button_text VARCHAR(64) NOT NULL,
      primary_color VARCHAR(16) NOT NULL,
      fields_json MEDIUMTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

// ---------- helpers ----------
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
function buildResolveUrl(member) {
  const client = member.codigoCliente || member.clientCode;
  const campaign = member.codigoCampana || member.campaignCode;
  if (!client || !campaign) return "";
  return `${API_BASE}/api/wallet/resolve?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}&source=link`;
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

router.post("/distribution/settings", async (req, res) => {
  try {
    if (SKIP_DB) return res.json({ ok: true }); // no-op cuando no hay DB

    await ensureTable();
    const b = req.body || {};
    await pool.query(
      `UPDATE distribution_settings
       SET enabled=?, subject=?, from_name=?, button_text=?, light_bg=?, dark_bg=?, body_color_light=?, body_color_dark=?, html_body=?
       WHERE id=1`,
      [
        b.enabled ? 1 : 0, b.subject || "", b.fromName || "", b.buttonText || "",
        b.lightBg || "#143c5c", b.darkBg || "#0f2b40",
        b.bodyColorLight || "#c69667", b.bodyColorDark || "#0f2b40",
        b.htmlBody || ""
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ========== TIERS ==========
router.get("/distribution/tiers", async (_req, res) => {
  res.json([{ id: "gold_15", name: "Gold 15%" }, { id: "blue_5", name: "Blue 5%" }]);
});

// Enrollment simple (puedes persistir si quieres)
router.get("/distribution/enrollment", async (_req, res) => {
  res.json({ gold_15: true, blue_5: true });
});
router.post("/distribution/enrollment", async (_req, res) => {
  // si necesitas persistir, guarda _req.body; por ahora devolvemos ok
  res.json({ ok: true });
});

// ========== SEND WELCOME: delega al endpoint moderno ==========
async function sendWelcomeEmail(memberIdOrObject) {
  try {
    // Cargar miembro según lo que recibamos
    let m = null;
    if (memberIdOrObject && typeof memberIdOrObject === "object") {
      m = memberIdOrObject;
    } else if (!SKIP_DB) {
      const [[row]] = await pool.query(
        `SELECT id, codigoCliente, codigoCampana, nombre, apellido, email
         FROM members WHERE id=? LIMIT 1`, [memberIdOrObject]
      );
      m = row;
    }
    if (!m || !m.email || !m.codigoCliente || !m.codigoCampana) return;

    // Delegar al endpoint que arma el Google Save URL directo y envía el correo
    // oneButton=true -> correo con botón rojo "Guardar en el móvil"
    await fetch(`${API_BASE}/api/wallet/send?oneButton=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client:   m.codigoCliente,
        campaign: m.codigoCampana,   // "gold_15" o "blue_5"
        email:    m.email
      })
    }).catch(() => {});
  } catch (e) {
    console.warn("sendWelcomeEmail delegation error:", e?.message || e);
  }
}

// ========== REGISTER BUILDER (admin) ==========
router.get("/distribution/register-config", async (req, res) => {
  try {
    const tier = String(req.query.tier || "").trim();
    if (!tier) return res.status(400).json({ ok:false, error:"tier requerido" });

    if (SKIP_DB) {
      const cfg = defaultFormForTier(tier);
      return res.json({ ok: true, ...cfg });
    }

    await ensureTable();
    const [rows] = await pool.query(`SELECT * FROM registration_forms WHERE tier_id=? LIMIT 1`, [tier]);
    if (rows.length) {
      const r = rows[0];
      return res.json({
        ok:true,
        tierId: r.tier_id,
        slug: r.slug,
        enabled: !!r.enabled,
        title: r.title,
        intro: r.intro,
        buttonText: r.button_text,
        primaryColor: r.primary_color,
        fields: JSON.parse(r.fields_json || "[]"),
      });
    }

    const cfg = defaultFormForTier(tier);
    await pool.query(
      `INSERT INTO registration_forms
       (tier_id, slug, enabled, title, intro, button_text, primary_color, fields_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cfg.tierId, cfg.slug, cfg.enabled ? 1 : 0,
        cfg.title, cfg.intro, cfg.buttonText, cfg.primaryColor,
        JSON.stringify(cfg.fields),
      ]
    );
    res.json({ ok:true, ...cfg });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

router.post("/distribution/register-config", async (req, res) => {
  try {
    const b = req.body || {};
    const tier = String(b.tierId || "").trim();
    if (!tier) return res.status(400).json({ ok:false, error:"tierId requerido" });

    if (SKIP_DB) {
      return res.json({ ok:true, slug: makeSlug() });
    }

    await ensureTable();
    const fields = Array.isArray(b.fields) ? b.fields : [];
    await pool.query(
      `INSERT INTO registration_forms
       (tier_id, slug, enabled, title, intro, button_text, primary_color, fields_json)
       VALUES (?, COALESCE((SELECT slug FROM registration_forms WHERE tier_id=?), ?),
               ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled=VALUES(enabled),
         title=VALUES(title),
         intro=VALUES(intro),
         button_text=VALUES(button_text),
         primary_color=VALUES(primary_color),
         fields_json=VALUES(fields_json)`,
      [
        tier, tier, makeSlug(),
        b.enabled ? 1 : 0,
        b.title || "",
        b.intro || "",
        b.buttonText || "REGISTER",
        b.primaryColor || "#8b173c",
        JSON.stringify(fields),
      ]
    );

    const [[row]] = await pool.query(`SELECT slug FROM registration_forms WHERE tier_id=?`, [tier]);
    res.json({ ok:true, slug: row?.slug });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

router.get("/distribution/register-config-by-slug", async (req, res) => {
  try {
    const slug = String(req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ ok:false, error:"slug requerido" });

    if (SKIP_DB) return res.status(404).json({ ok:false });

    await ensureTable();
    const [[r]] = await pool.query(`SELECT * FROM registration_forms WHERE slug=? LIMIT 1`, [slug]);
    if (!r || !r.enabled) return res.status(404).json({ ok:false });

    res.json({
      ok:true,
      tierId: r.tier_id,
      slug: r.slug,
      title: r.title,
      intro: r.intro,
      buttonText: r.button_text,
      primaryColor: r.primary_color,
      fields: JSON.parse(r.fields_json || "[]"),
    });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

router.post("/distribution/register-submit", async (req, res) => {
  try {
    const b = req.body || {};
    const slug = String(b.slug || "").trim();
    if (!slug) return res.status(400).json({ ok:false, error:"slug requerido" });

    if (SKIP_DB) {
      // sin DB: genera datos sintéticos y responde
      const client   = b.codigoCliente || `M-${nanoid(6).toUpperCase()}`;
      const campaign = b.codigoCampana || "blue_5";
      const resolveUrl = `${API_BASE}/api/wallet/resolve?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}&source=register`;
      return res.json({ ok:true, memberId: 0, resolveUrl, client, campaign });
    }

    await ensureTable();

    const [[form]] = await pool.query(`SELECT tier_id FROM registration_forms WHERE slug=? LIMIT 1`, [slug]);
    if (!form) return res.status(404).json({ ok:false, error:"form no encontrado" });
    const tierId = form.tier_id;

    const nombre   = b.nombre   || "";
    const apellido = b.apellido || "";
    const email    = b.email    || "";
    const telefono = b.telefono || "";

    const client   = b.codigoCliente || `M-${nanoid(6).toUpperCase()}`;
    const campaign = b.codigoCampana || tierId;

    const [r] = await pool.query(
      `INSERT INTO members (codigoCliente, codigoCampana, nombre, apellido, email, telefono)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [client, campaign, nombre, apellido, email, telefono]
    );

    const memberId = r.insertId;
    try { await sendWelcomeEmail(memberId); } catch {}

    const resolveUrl = `${API_BASE}/api/wallet/resolve?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}&source=register`;
    res.json({ ok:true, memberId, resolveUrl, client, campaign });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
});

router.post("/distribution/send-test-email", async (req, res) => {
  try {
    const { email, displayName, clientCode, campaignCode } = req.body;

    // Genera/obtén tus URLs reales
    const googleUrl = await buildGoogleSaveUrl({ clientCode, campaignCode, displayName });
    const appleUrl  = await buildAppleUrl({ clientCode, campaignCode, displayName });

    await sendWelcomeEmail({
      to: email,
      displayName,
      googleUrl,
      appleUrl,
      settings: req.body.settings || {} // opcional, si personalizas
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message || "fail" });
  }
});


module.exports = { router, sendWelcomeEmail };
