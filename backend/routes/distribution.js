// backend/routes/distribution.js
const express = require("express");
const router = express.Router();
const { pool } = require("../src/db");
const nodemailer = require("nodemailer");
const { nanoid } = require("nanoid");

const API_BASE = process.env.PUBLIC_BASE_URL || ""; // para links absolutos

// ---------- SMTP ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ---------- DB bootstrap ----------
async function ensureTable() {
  // Settings del email (tema claro/oscuro + cuerpo editable)
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
               '<p><strong>Estimado/a {{NAME}},</strong></p><p>Bienvenido a nuestro programa <em>Lealtad Alcazarén</em>. A partir de hoy podrás guardar tu tarjeta digital en tu billetera móvil (Apple Wallet o Google Wallet) y disfrutar de tus beneficios en tienda.</p><p>Toca el botón para continuar:</p><p><strong>{{BUTTON_TEXT}}</strong></p><p>Saludos cordiales.<br><strong>Distribuidora Alcazarén</strong></p>')`
    );
  }

  // Config del formulario público por tier
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
function buildResolveUrl(member) {
  const client = member.codigoCliente || member.clientCode;
  const campaign = member.codigoCampana || member.campaignCode;
  if (!client || !campaign) return "";
  const base = API_BASE;
  // Usa source=link (compatible con tu enum)
  return `${base}/api/wallet/resolve?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}&source=link`;
}

function emailHTML(settings, resolveUrl, member) {
  const fullName = [member?.nombre, member?.apellido].filter(Boolean).join(" ").trim();
  const safeBody = String(settings.html_body || "")
    .replaceAll("{{BUTTON_TEXT}}", settings.button_text || "Guardar en el móvil")
    .replaceAll("{{NAME}}", fullName || "cliente")
    .replaceAll("{{CLIENT}}", member?.codigoCliente || "")
    .replaceAll("{{CAMPAIGN}}", member?.codigoCampana || "");

  return `
<meta name="color-scheme" content="light dark">
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; background:${settings.light_bg}; font:16px system-ui,-apple-system,Segoe UI,Roboto; color:#fff; }
  .wrap { max-width:720px; margin:0 auto; padding:24px; }
  .card { background:${settings.body_color_light}; padding:28px; border-radius:16px; line-height:1.45; }
  .btn { display:inline-block; padding:12px 18px; background:#8b173c; color:#fff; border-radius:8px; text-decoration:none; font-weight:600; }
  @media (prefers-color-scheme: dark){
    body { background:${settings.dark_bg}; }
    .card { background:${settings.body_color_dark}; }
  }
</style>
<div class="wrap">
  <div class="card">
    <h2 style="margin-top:0">Su Tarjeta de Lealtad</h2>
    ${safeBody}
    <p style="margin-top:24px"><a class="btn" href="${resolveUrl}">${settings.button_text}</a></p>
  </div>
</div>`.trim();
}

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

// ---------- SETTINGS ----------
router.get("/distribution/settings", async (_req, res) => {
  try {
    await ensureTable();
    const [[row]] = await pool.query(`
      SELECT enabled, subject, from_name AS fromName, button_text AS buttonText,
             light_bg AS lightBg, dark_bg AS darkBg,
             body_color_light AS bodyColorLight, body_color_dark AS bodyColorDark,
             html_body AS htmlBody
      FROM distribution_settings WHERE id=1`);
    res.json(row || {});
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

router.post("/distribution/settings", async (req, res) => {
  try {
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
    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

// ---------- TIERS ----------
router.get("/distribution/tiers", async (_req, res) => {
  // si tienes tabla real, cámbialo; por ahora fijos:
  res.json([{ id:"gold_15", name:"Gold 15%" }, { id:"base", name:"Blue 5%" }]);
});

// Enrollment (mapa simple; si quieres persistir, crea tabla aparte)
router.get("/distribution/enrollment", async (_req, res) => {
  res.json({ gold_15: true, base: true });
});

// ---------- SEND WELCOME ----------
async function sendWelcomeEmail(memberId) {
  await ensureTable();
  const [[settings]] = await pool.query(`SELECT * FROM distribution_settings WHERE id=1`);
  if (!settings || !settings.enabled) return;

  const [[m]] = await pool.query(
    `SELECT id, codigoCliente, codigoCampana, nombre, apellido, email
     FROM members WHERE id=? LIMIT 1`, [memberId]
  );
  if (!m || !m.email) return;

  const resolveUrl = buildResolveUrl(m);
  if (!resolveUrl) return;

  const html = emailHTML(settings, resolveUrl, m);
  await transporter.sendMail({
    from: process.env.MAIL_FROM || `"${settings.from_name}" <no-reply@passforge.local>`,
    to: m.email,
    subject: settings.subject || "Tu pase digital",
    html,
  });
}

// ---------- REGISTER BUILDER (admin) ----------
router.get("/distribution/register-config", async (req, res) => {
  try {
    await ensureTable();
    const tier = String(req.query.tier || "").trim();
    if (!tier) return res.status(400).json({ ok:false, error:"tier requerido" });

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

    // crear default
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
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

router.post("/distribution/register-config", async (req, res) => {
  try {
    await ensureTable();
    const b = req.body || {};
    const tier = String(b.tierId || "").trim();
    if (!tier) return res.status(400).json({ ok:false, error:"tierId requerido" });

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
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

// ---------- REGISTER público (slug) ----------
router.get("/distribution/register-config-by-slug", async (req, res) => {
  try {
    await ensureTable();
    const slug = String(req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ ok:false, error:"slug requerido" });

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
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

router.post("/distribution/register-submit", async (req, res) => {
  try {
    await ensureTable();
    const b = req.body || {};
    const slug = String(b.slug || "").trim();
    if (!slug) return res.status(400).json({ ok:false, error:"slug requerido" });

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
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = { router, sendWelcomeEmail };
