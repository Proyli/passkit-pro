// email/sendWallet.js
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { renderWalletEmail, mergeSettings } = require("./renderWalletEmail");

// transporter Outlook 365 (usa tus ENV)
function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, // smtp.office365.com
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendWalletEmail({ to, displayName, membershipId, smartUrl, overrides = {} }) {
  const settings = mergeSettings(overrides);
  const { subject = "Su Tarjeta de Lealtad" } = settings;

  // Render (usa tu template)
  const html = renderWalletEmail(settings, { displayName, membershipId, smartUrl });

  // Subject único para romper el hilo
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0,16);
  const uniqueSubject = `${subject} • ${displayName || membershipId || ""} • ${ts}`;

  // Message-Id único (evita threading)
  const messageId = `<${crypto.randomBytes(9).toString("hex")}@alcazaren.com.gt>`;

  const transporter = makeTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'PassForge <linda.perez@alcazaren.com.gt>',
    to,
    subject: uniqueSubject,
    html,
    text:
      `Su Tarjeta de Lealtad\n\n` +
      `Hola ${displayName || ""}, guarde su tarjeta en su billetera digital.\n\n` +
      `Añadir a mi Wallet: ${smartUrl}\n\n` +
      `Este es un correo automático. No responda a este mensaje.`,

    // 👇 Claves para que NO sea respuesta/quoted
    inReplyTo: undefined,
    references: undefined,
    messageId,

    // Cabeceras útiles
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      // Opcional: mejora entregabilidad
      "List-Unsubscribe": `<mailto:${process.env.SMTP_USER}?subject=unsubscribe>`
    },
  });
}

module.exports = { sendWalletEmail };
