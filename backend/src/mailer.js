// backend/src/mailer.js
const nodemailer = require("nodemailer");

// --- Transports ---
const outlookTransport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,                 // STARTTLS en 587
      requireTLS: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { minVersion: "TLSv1.2" },
    })
  : null;

const gmailTransport = process.env.GMAIL_SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.GMAIL_SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.GMAIL_SMTP_PORT || 465),
      secure: String(process.env.GMAIL_SMTP_PORT || 465) === "465", // SSL en 465
      auth: { user: process.env.GMAIL_SMTP_USER, pass: process.env.GMAIL_SMTP_PASS },
      tls: { minVersion: "TLSv1.2" },
    })
  : null;

// --- Utils ---
function extractEmail(str) {
  const m = String(str || "").match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i);
  return m ? m[1].toLowerCase() : "";
}

function chooseTransportAndFrom(desiredFrom) {
  const defaultOutlookFrom = process.env.MAIL_FROM || `PassForge <${process.env.SMTP_USER}>`;
  const defaultGmailFrom   = process.env.MAIL_FROM_GMAIL || `PassForge <${process.env.GMAIL_SMTP_USER}>`;

  const desired = (desiredFrom || defaultOutlookFrom).trim();
  const email   = extractEmail(desired);

  // Reglas:
  // - Dominio corporativo -> Outlook
  // - Gmail -> Gmail
  // - Otro -> Outlook por defecto
  if (email.endsWith("@alcazaren.com.gt")) {
    if (!outlookTransport) throw new Error("SMTP Outlook no configurado");
    return { via: "outlook", transport: outlookTransport, from: defaultOutlookFrom };
  }
  if (email.endsWith("@gmail.com")) {
    if (!gmailTransport) throw new Error("SMTP Gmail no configurado");
    return { via: "gmail", transport: gmailTransport, from: defaultGmailFrom };
  }
  if (!outlookTransport) throw new Error("SMTP Outlook no configurado");
  return { via: "outlook", transport: outlookTransport, from: defaultOutlookFrom };
}

/**
 * Envía un correo garantizando que el FROM coincide con el transporte.
 * @param {object} message { to, subject, html?, text?, from? }
 */
async function sendMailSmart(message = {}) {
  const { to, subject, html, text, headers } = message;
  if (!to) throw new Error("sendMailSmart: 'to' requerido");
  if (!subject) throw new Error("sendMailSmart: 'subject' requerido");
  if (!html && !text) throw new Error("sendMailSmart: 'html' o 'text' requerido");

  // Elegir transporte según FROM deseado (o default corporativo)
  const desiredFrom = message.from || process.env.MAIL_FROM || `PassForge <${process.env.SMTP_USER}>`;
  const choice = chooseTransportAndFrom(desiredFrom);

  // Enviar SIEMPRE con el from alineado a la cuenta autenticada
  const info = await choice.transport.sendMail({
    from: choice.from,
    to,
    subject,
    html,
    text,
    headers: headers || {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
  });

  return {
    ok: true,
    via: choice.via,
    envelope: info.envelope,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

module.exports = { sendMailSmart };
