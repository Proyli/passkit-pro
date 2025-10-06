// backend/src/mailer.js
const nodemailer = require("nodemailer");

// --- Transports ---
// Dev/test transport (Ethereal) will be created on demand if MAIL_DEV or NODE_ENV=development
let etherealTransport = null;
async function getEtherealTransport() {
  if (etherealTransport) return etherealTransport;
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealTransport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("[mailer] Ethereal transport configured for development. Preview mails at: https://ethereal.email/messages");
    return etherealTransport;
  } catch (err) {
    console.warn("[mailer] Could not create Ethereal transport:", err?.message || err);
    return null;
  }
}
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

  // If in development mode or MAIL_DEV=true, prefer Ethereal (test) transport
  const isDevMail = String(process.env.MAIL_DEV || "").toLowerCase() === "true" ||
    String(process.env.NODE_ENV || "").toLowerCase() === "development";

  if (isDevMail) {
    const eth = await getEtherealTransport();
    const from = message.from || process.env.MAIL_FROM || `PassForge <${process.env.SMTP_USER}>`;
    if (eth) {
      try {
        const info = await eth.sendMail({ from, to, subject, html, text, headers: headers || {} });
        const previewUrl = nodemailer.getTestMessageUrl(info) || null;
        return {
          ok: true,
          via: "ethereal",
          previewUrl,
          envelope: info.envelope,
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        };
      } catch (err) {
        console.warn('[mailer] Ethereal send failed, falling back to file:', err?.message || err);
        // fall through to file fallback
      }
    }

    // If Ethereal is not available or failed, save the mail to a tmp file for inspection
    try {
      const os = require('os');
      const tmpDir = require('path').join(__dirname, '..', 'tmp-mails');
      const fs = require('fs');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `mail-${stamp}.html`;
      const filePath = require('path').join(tmpDir, filename);
      const content = html || (text ? `<pre>${String(text).replace(/</g,'&lt;')}</pre>` : '<!-- empty -->');
      fs.writeFileSync(filePath, content, 'utf8');
      return { ok: true, via: 'file', previewPath: filePath };
    } catch (err) {
      console.error('[mailer] Failed to write dev mail to file:', err?.message || err);
      throw new Error('Ethereal unavailable and fallback write failed');
    }
  }

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
