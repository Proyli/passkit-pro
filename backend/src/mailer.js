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
 * Prioridad: Outlook -> Gmail (cámbiala si quieres).
 */
async function sendMailSmart(message) {
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
      from: process.env.MAIL_FROM_GMAIL || undefined,
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
        from: message.from || t.from, // “from” acorde al remitente del transporte
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
