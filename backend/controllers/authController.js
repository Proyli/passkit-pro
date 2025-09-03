const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const db = require("../models");
const Member = db.Member;
const { renderEmail } = require("../services/renderEmail");

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
exports.sendPassEmail = async (req, res) => {
  try {
    const {
      to,               // email destino (obligatorio)
      displayName,      // nombre del cliente
      buttonText,       // texto del botón (opcional)
      googleUrl,        // URL Google Wallet (obligatorio)
      appleUrl,         // URL Apple Wallet (opcional)
      htmlTemplate,     // HTML base del diseñador (obligatorio)
      subject,          // asunto opcional
      from,             // from opcional
    } = req.body;

    if (!to || !googleUrl || !htmlTemplate) {
      return res.status(400).json({ ok: false, error: "Missing to/googleUrl/htmlTemplate" });
    }

    const html = renderEmail(htmlTemplate, {
      displayName,
      buttonText,
      googleUrl,
      appleUrl,
    });

    await transporter.sendMail({
      from: from || DEFAULT_FROM,
      to,
      subject: subject || "Su Tarjeta de Lealtad",
      html,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("sendPassEmail error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Email send failed" });
  }
};
