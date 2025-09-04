const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const db = require("../models");
const Member = db.Member;
// arriba del archivo
const { renderWalletEmail, DEFAULTS } = require("../services/renderEmail");

async function sendLoyaltyEmail(member, { googleUrl, appleUrl }) {
  const displayName = member.nombre || member.name || "Cliente";
  const externalId  = member.externalId || member.external_id || member.id || "";
  const payload     = `PK|${externalId}|ALCAZAREN`;
  const base        = process.env.PUBLIC_BASE_URL; // ej: https://backend-passforge.onrender.com

  const html = renderWalletEmail({}, { displayName, googleUrl, appleUrl });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"PassForge" <no-reply@alcazaren.com.gt>',
    to: member.email,
    subject: "Su Tarjeta de Lealtad",
    html,
    attachments: [
      {
        filename: "code128.png",
        path: `${base}/api/barcode/${encodeURIComponent(payload)}.png`,
        contentType: "image/png",
        cid: "code128",              // <img src="cid:code128"> en tu htmlBody
      },
      // Opcional: si tienes endpoint de QR
      // {
      //   filename: "qr.png",
      //   path: `${base}/api/qr/${encodeURIComponent(payload)}.png`,
      //   contentType: "image/png",
      //   cid: "qr",                // <img src="cid:qr">
      // },
    ],
  });
}
// ---------- SMTP (un solo transporter para todo el módulo) ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // true=465
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

transporter.verify()
  .then(() => console.log("✅ SMTP listo"))
  .catch(err => console.error("❌ SMTP error:", err?.message || err));

const DEFAULT_FROM =
  process.env.MAIL_FROM ||
  `"Distribuidora Alcazarén" <${process.env.SMTP_USER || "no-reply@alcazaren.com.gt"}>`;

// -------------------- LOGIN --------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Member.findOne({ where: { email } });

    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
    if (!user.password) return res.status(400).json({ error: "Este usuario aún no tiene contraseña" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Contraseña incorrecta" });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// -------------------- CAMBIAR CONTRASEÑA --------------------
exports.changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: "Faltan datos requeridos" });

    const user = await Member.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    if (!user.password) {
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return res.json({ message: "Contraseña creada correctamente" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: "Contraseña actual incorrecta" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error en changePassword:", error.message);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// -------------------- RESET PASSWORD (correo) --------------------
exports.resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "El correo es obligatorio" });

    const user = await Member.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const tempPassword = crypto.randomBytes(4).toString("hex");
    user.password = await bcrypt.hash(tempPassword, 10);
    await user.save();

    console.log("➡️ Enviando correo a:", user.email);

    await transporter.sendMail({
      from: DEFAULT_FROM,
      to: user.email,
      subject: "Tu nueva contraseña temporal",
      text: `Hola ${user.nombre || "usuario"}, tu nueva contraseña temporal es: ${tempPassword}`,
    });

    res.json({ message: "Se envió una nueva contraseña temporal a tu correo electrónico." });
  } catch (error) {
    console.error("❌ Error en resetPassword:", error.message);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// -------------------- ENVIAR PASS (bienvenida) --------------------
// -------------------- SEND PASS EMAIL --------------------
exports.sendPassEmail = async (req, res) => {
  try {
    const {
  to,
  displayName,
  buttonText,
  googleUrl,
  appleUrl,
  htmlTemplate,
  subject,
  from,
  settings,        // opcional
  membershipId,    // 👈 NUEVO (ID por cliente)
  logoUrl          // opcional, por si quieres reemplazar el del DEFAULTS
} = req.body;

if (!to || !googleUrl || !htmlTemplate) {
  return res.status(400).json({ ok: false, error: "Missing to/googleUrl/htmlTemplate" });
}

const html = renderWalletEmail(
  // Si mandas settings, respeta todo; si no, usa htmlTemplate+buttonText
  (settings ? { ...settings, logoUrl } : { htmlBody: htmlTemplate, buttonText: buttonText || DEFAULTS.buttonText, logoUrl }),
  { displayName, googleUrl, appleUrl, membershipId }
);


    await transporter.sendMail({
      from: from || DEFAULT_FROM,
      to,
      subject: subject || DEFAULTS.subject, // "Su Tarjeta de Lealtad"
      html,
      headers: {
        "Content-Language": "es",
        "X-Entity-Language": "es",
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("sendPassEmail error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Email send failed" });
  }
};




