const bcrypt = require('bcryptjs');
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const db = require("../models");
const Member = db.Member;

// LOGIN
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

// CAMBIAR CONTRASEÑA
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

// RESET PASSWORD (correo Outlook)
exports.resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "El correo es obligatorio" });

    const user = await Member.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const tempPassword = crypto.randomBytes(4).toString("hex");
    user.password = await bcrypt.hash(tempPassword, 10);
    await user.save();

    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: "SSLv3",
      },
    });

    console.log("➡️ Enviando correo a:", user.email);

    await transporter.sendMail({
      from: `"PassForge" <${process.env.EMAIL_USER}>`,
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
