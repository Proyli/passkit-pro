// backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const db = require("../models");
const Member = db.Member;

const { renderWalletEmail, DEFAULTS } = require("../services/renderEmail");

/* ================= SMTP primero (debe ir antes de cualquier uso) ================= */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // true=465
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  logger: true,
  debug: true,
  requireTLS: true,
});

transporter
  .verify()
  .then(() => console.log("✅ SMTP listo"))
  .catch((err) => console.error("❌ SMTP error:", err?.message || err));

const DEFAULT_FROM =
  process.env.MAIL_FROM ||
  `"Distribuidora Alcazarén" <${process.env.SMTP_USER || "no-reply@alcazaren.com.gt"}>`;

/* ================= Helper: enviar correo de lealtad reutilizable ================= */
async function sendLoyaltyEmail(
  member,
  {
    googleUrl,
    appleUrl,
    // opcionales
    settings,
    htmlTemplate,
    buttonText,
    logoUrl,
    membershipId,
    subject,
    from,
  } = {}
) {
  const displayName = member?.nombre || member?.name || "Cliente";
  const externalId = member?.externalId || member?.external_id || member?.id || "";
  const payload = `PK|${externalId}|ALCAZAREN`;
  const base = process.env.PUBLIC_BASE_URL || "";

  // Construir HTML (settings o htmlTemplate)
  const html = renderWalletEmail(
    settings
      ? { ...settings, logoUrl }
      : { htmlBody: htmlTemplate, buttonText: buttonText || DEFAULTS.buttonText, logoUrl },
    { displayName, googleUrl, appleUrl, membershipId }
  );

  // Enviar
  const info = await transporter.sendMail({
    from: from || process.env.SMTP_FROM || DEFAULT_FROM,
    to: member.email,
    subject: subject || DEFAULTS.subject || "Su Tarjeta de Lealtad",
    html,
    headers: {
      "Content-Language": "es",
      "X-Entity-Language": "es",
    },
    attachments: [
      {
        filename: "code128.png",
        path: base ? `${base}/api/barcode/${encodeURIComponent(payload)}.png` : undefined,
        contentType: "image/png",
        cid: "code128",
      },
      // Si tienes QR, descomenta:
      // {
      //   filename: "qr.png",
      //   path: base ? `${base}/api/qr/${encodeURIComponent(payload)}.png` : undefined,
      //   contentType: "image/png",
      //   cid: "qr",
      // },
    ].filter(Boolean),
  });

  console.log("📩 sendWelcomeEmail:", {
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });
}

/* ================= Endpoint: enviar correo de bienvenida ================= */
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
      settings, // opcional
      membershipId,
      logoUrl, // opcional
    } = req.body;

    if (!to || !googleUrl || !htmlTemplate) {
      return res.status(400).json({ ok: false, error: "Missing to/googleUrl/htmlTemplate" });
    }

    const html = renderWalletEmail(
      settings
        ? { ...settings, logoUrl }
        : { htmlBody: htmlTemplate, buttonText: buttonText || DEFAULTS.buttonText, logoUrl },
      { displayName, googleUrl, appleUrl, membershipId }
    );

    const info = await transporter.sendMail({
      from: from || DEFAULT_FROM,
      to,
      subject: subject || DEFAULTS.subject,
      html,
      headers: {
        "Content-Language": "es",
        "X-Entity-Language": "es",
      },
    });

    console.log("📩 sendPassEmail:", {
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("sendPassEmail error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Email send failed" });
  }
};

/* ================= Resto de endpoints (como los tenías) ================= */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Modo resiliente: si no hay DB disponible, permite login con usuarios de entorno
    if (process.env.SKIP_DB === "true") {
      const defaultPass = process.env.SEED_ADMIN_PASSWORD || process.env.SEED_USER_PASSWORD || "Temporal#2024";
      const ALLOWED = new Map([
        ["admin@alcazaren.com.gt", "admin"],
        ["ventas1.digital@alcazaren.com.gt", "user"],
        ["andrea@alcazaren.com.gt", "user"],
        ["julio@alcazaren.com.gt", "user"],
        ["linda.perez@alcazaren.com.gt", "user"],
      ]);

      const role = ALLOWED.get(String(email || "").toLowerCase());
      if (!role || password !== defaultPass) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      const AUTH_SECRET = process.env.AUTH_JWT_SECRET || process.env.WALLET_TOKEN_SECRET || "dev-auth";
      const token = jwt.sign({ sub: email, email, role }, AUTH_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: { id: 0, name: email, role } });
    }

    const user = await Member.findOne({ where: { email } });

    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
    if (!user.password) return res.status(400).json({ error: "Este usuario aún no tiene contraseña" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Contraseña incorrecta" });

    const AUTH_SECRET = process.env.AUTH_JWT_SECRET || process.env.WALLET_TOKEN_SECRET || "dev-auth";
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role || "user" },
      AUTH_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.nombre || user.email,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    res.status(500).json({ error: "Error del servidor" });
  }
};

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

    const info = await transporter.sendMail({
      from: DEFAULT_FROM,
      to: user.email,
      subject: "Tu nueva contraseña temporal",
      text: `Hola ${user.nombre || "usuario"}, tu nueva contraseña temporal es: ${tempPassword}`,
    });

    console.log("📩 resetPassword:", {
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    res.json({ message: "Se envió una nueva contraseña temporal a tu correo electrónico." });
  } catch (error) {
    console.error("❌ Error en resetPassword:", error.message);
    res.status(500).json({ error: "Error del servidor" });
  }
};
