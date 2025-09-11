// backend/src/mailer.js
const nodemailer = require("nodemailer");

function makeOutlook() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function makeGmail() {
  if (!process.env.GMAIL_SMTP_HOST) return null;
  const port = Number(process.env.GMAIL_SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST,
    port,
    secure: port === 465, // SSL en 465, STARTTLS si 587
    auth: { user: process.env.GMAIL_SMTP_USER, pass: process.env.GMAIL_SMTP_PASS },
  });
}

const txOutlook = makeOutlook();
const txGmail   = makeGmail();

/**
 * Envía por el primer transport disponible; si falla, intenta con el segundo.
 * Prioridad: Outlook -> Gmail.
 */
async function sendMailSmart(message = {}) {  // ⬅⬅⬅ default evita leer props de undefined
  const { to, subject, html, text, from: fromIn } = message;

  // Validaciones amigables (evita llamadas “vacías”)
  if (!to) throw new Error("sendMailSmart: 'to' requerido");
  if (!subject) throw new Error("sendMailSmart: 'subject' requerido");
  if (!html && !text) throw new Error("sendMailSmart: 'html' o 'text' requerido");

  const tries = [];

  if (txOutlook) {
    tries.push({
      name: "outlook",
      tx: txOutlook,
      from: process.env.MAIL_FROM_OUTLOOK || process.env.MAIL_FROM || undefined,
    });
  }
  if (txGmail) {
    tries.push({
      name: "gmail",
      tx: txGmail,
      from: process.env.MAIL_FROM_GMAIL || process.env.MAIL_FROM || undefined,
    });
  }

  if (!tries.length) {
    throw new Error("No hay transportes SMTP configurados (Outlook/Gmail).");
  }

  let lastErr;
  for (const t of tries) {
    try {
      const info = await t.tx.sendMail({
        ...message,
        from: fromIn || t.from || "PassForge <no-reply@alcazaren.com.gt>", // ⬅ fallback final
      });
      return { ok: true, via: t.name, info };
    } catch (e) {
      lastErr = e;
      console.warn(`sendMailSmart: fallo via ${t.name}:`, e?.message || e);
    }
  }
  throw lastErr || new Error("No se pudo enviar por ningún transporte.");
}

module.exports = { sendMailSmart };
