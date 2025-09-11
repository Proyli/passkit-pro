const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const db = require("../models");
const Member = db.Member;

const SECRET = process.env.WALLET_TOKEN_SECRET || "changeme";
const BASE   = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * Crea un transporter dinámico según el tipo (outlook/gmail)
 */
function createTransporter(type = "outlook") {
  if (type === "gmail") {
    return nodemailer.createTransport({
      host: process.env.GMAIL_SMTP_HOST,
      port: Number(process.env.GMAIL_SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.GMAIL_SMTP_USER,
        pass: process.env.GMAIL_SMTP_PASS,
      },
    });
  } else {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      requireTLS: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { minVersion: "TLSv1.2" },
    });
  }
}

/**
 * Puede recibir el objeto miembro { id, codigoCliente, codigoCampana, nombre, apellido, email }
 * o solo un número con el memberId.
 * Se puede pasar "provider" = "outlook" | "gmail"
 */
async function sendWelcomeEmail(memberOrId, provider = "outlook") {
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

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Su Tarjeta de Lealtad</h2>
      <p><strong>Estimado${m.nombre ? " " + m.nombre : ""},</strong></p>
      <p>Bienvenido a nuestro programa <em>Lealtad Alcazarén</em>.</p>
      <p>
        <a href="${appleUrl}">Guardar en Apple Wallet</a> |
        <a href="${googleUrl}">Guardar en Google Wallet</a>
      </p>
      <p style="font-size:12px;color:#666;">El enlace expira en 15 minutos.</p>
    </div>
  `;

  // Seleccionar el transporter correcto
  const transporter = createTransporter(provider);

  const from =
    provider === "gmail"
      ? process.env.MAIL_FROM_GMAIL || `"Distribuidora Alcazarén" <${process.env.GMAIL_SMTP_USER}>`
      : process.env.MAIL_FROM || `"PassForge" <${process.env.SMTP_USER}>`;

  const info = await transporter.sendMail({
    from,
    to: m.email,
    subject: "Tu tarjeta de lealtad",
    html,
  });

  console.log("📬 Enviado con", provider, "->", info.response);
}

module.exports = { sendWelcomeEmail };
