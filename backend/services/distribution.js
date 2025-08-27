// backend/services/distribution.js
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const db = require("../models");
const Member = db.Member;

const SECRET = process.env.WALLET_TOKEN_SECRET || "changeme";
const BASE = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

/**
 * Puede recibir el objeto miembro { id, codigoCliente, codigoCampana, nombre, apellido, email }
 * o solo un número con el memberId.
 */
async function sendWelcomeEmail(memberOrId) {
  let m = memberOrId;

  // Si viene solo el id, lo buscamos
  if (typeof memberOrId === "number") {
    m = await Member.findByPk(memberOrId);
    if (!m) return;
  }

  if (!m || !m.email) return;

  // Token corto (15 min) que ya usas en /wallet/ios|google/:token
  const token = jwt.sign(
    { id: m.id, client: m.codigoCliente, campaign: m.codigoCampana },
    SECRET,
    { expiresIn: "15m" }
  );

  const appleUrl  = `${BASE}/api/wallet/ios/${token}`;
  const googleUrl = `${BASE}/api/wallet/google/${token}`;

  // Paleta (tomada de tus capturas)
  const lightBg = "#c69667";  // cuerpo claro
  const darkBg  = "#0f3451";  // cuerpo oscuro
  const btnBg   = "#8b173c";  // botón
  const btnTxt  = "#ffffff";

  const html = `
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    /* estilos base */
    .wrap { font-family: Inter, Arial, sans-serif; margin:0; padding:0; }
    .body { background:${lightBg}; color:#111; padding:24px; border-radius:8px; }
    .title { font-size:22px; font-weight:700; margin:0 0 16px 0; }
    .small { color:#444; font-size:13px; }
    .btn { display:inline-block; padding:12px 18px; border-radius:8px; text-decoration:none; font-weight:600; }
    .btn-primary { background:${btnBg}; color:${btnTxt}; }
    .btn-outline { border:1px solid #111; color:#111; }
    .buttons { display:flex; gap:10px; margin:18px 0; }

    /* Dark mode */
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
        A partir de hoy podrá guardar su tarjeta digital en su billetera móvil (Apple Wallet o Google Wallet)
        y disfrutar de sus beneficios en tienda.
      </p>

      <div class="buttons">
        <a class="btn btn-outline" href="${appleUrl}">Guardar en Apple Wallet</a>
        <a class="btn btn-primary" href="${googleUrl}">Guardar en Google Wallet</a>
      </div>

      <p class="small">El enlace expira en 15 minutos.</p>
      <p class="small">Distribuidora Alcazarén</p>
    </div>
  </div>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"PassForge" <no-reply@passforge.local>',
    to: m.email,
    subject: "Tu tarjeta de lealtad",
    html,
  });
}

module.exports = { sendWelcomeEmail };
