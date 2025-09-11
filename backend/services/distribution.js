// backend/services/distribution.js
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const db = require("../models");
const Member = db.Member;

const SECRET = process.env.WALLET_TOKEN_SECRET || "changeme";
const BASE   = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

// ---------- SMTP ----------
const SMTP_HOST    = process.env.SMTP_HOST || "smtp.office365.com";
const SMTP_PORT    = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE  = String(process.env.SMTP_SECURE || "false") === "true"; // true => 465
const SMTP_USER    = process.env.SMTP_USER;
const SMTP_PASS    = process.env.SMTP_PASS;

// From seguro: igual a SMTP_USER si no defines SMTP_FROM
const SAFE_FROM = process.env.SMTP_FROM || `"Distribuidora Alcazaren" <${SMTP_USER}>`;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,        // false con 587 (STARTTLS), true con 465
  requireTLS: !SMTP_SECURE,   // fuerza STARTTLS cuando uses 587
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  tls: { minVersion: "TLSv1.2" },
});

transporter.verify()
  .then(() => console.log("✅ SMTP listo:", SMTP_HOST, SMTP_PORT, SMTP_SECURE ? "SSL" : "STARTTLS"))
  .catch(err => console.error("❌ SMTP error:", err.message));

/**
 * Puede recibir el objeto miembro { id, codigoCliente, codigoCampana, nombre, apellido, email }
 * o solo un número con el memberId.
 */
async function sendWelcomeEmail(memberOrId) {
  let m = memberOrId;

  if (typeof memberOrId === "number") {
    m = await Member.findByPk(memberOrId);
    if (!m) return;
  }
  if (!m || !m.email) return;

  const token = jwt.sign(
    { id: m.id, client: m.codigoCliente, campaign: m.codigoCampana },
    SECRET,
    { expiresIn: "15m" }
  );

  const appleUrl  = `${BASE}/api/wallet/ios/${token}`;
  const googleUrl = `${BASE}/api/wallet/google/${token}`;

  const lightBg = "#c69667";
  const darkBg  = "#0f3451";
  const btnBg   = "#8b173c";
  const btnTxt  = "#ffffff";

  const html = `
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    .wrap { font-family: Inter, Arial, sans-serif; margin:0; padding:0; }
    .body { background:${lightBg}; color:#111; padding:24px; border-radius:8px; }
    .title { font-size:22px; font-weight:700; margin:0 0 16px 0; }
    .small { color:#444; font-size:13px; }
    .btn { display:inline-block; padding:12px 18px; border-radius:8px; text-decoration:none; font-weight:600; }
    .btn-primary { background:${btnBg}; color:${btnTxt}; }
    .btn-outline { border:1px solid #111; color:#111; }
    .buttons { display:flex; gap:10px; margin:18px 0; }
    @media (prefers-color-scheme: dark) {
      .body { background:${darkBg}; color:#fff; }
      .small { color:#CBD5E1; }
      .btn-outline { border:1px solid #fff; color:#fff; }
    }
  </style>

  <div class="wrap">
    <h2 class="title">Su Tarjeta de Lealtad</h2>
    <div class="body">
      <p><strong>Estimado${m.nombre ? " " + m.nombre : ""},</strong></p>
      <p>
        Bienvenido a nuestro programa <em>Lealtad Alcazarén</em>.
        Puede guardar su tarjeta digital en Apple Wallet o Google Wallet y disfrutar de sus beneficios.
      </p>
      <div class="buttons">
        <a class="btn btn-outline" href="${appleUrl}">Guardar en Apple Wallet</a>
        <a class="btn btn-primary" href="${googleUrl}">Guardar en Google Wallet</a>
      </div>
      <p class="small">El enlace expira en 15 minutos.</p>
      <p class="small">Distribuidora Alcazaren</p>
    </div>
  </div>
  `;

  await transporter.sendMail({
    from: SAFE_FROM,        // ← SIEMPRE corporativo/SMTP
    to: m.email,
    subject: "Tu tarjeta de lealtad",
    html,
  });
}

module.exports = { sendWelcomeEmail };
