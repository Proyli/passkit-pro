// backend/controllers/walletController.js
const jwt = require("jsonwebtoken");

const SECRET = process.env.WALLET_TOKEN_SECRET || "dev-secret";

// Helper para detectar iOS por User-Agent
function isIOS(ua = "") {
  ua = ua.toLowerCase();
  return ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod");
}

exports.resolve = async (req, res) => {
  try {
    const { client, campaign } = req.query;
    if (!client || !campaign) {
      return res.status(400).json({ message: "Faltan parámetros: client, campaign" });
    }

    // TODO: Busca el miembro en tu BD real (Sequelize / pool MySQL).
    // Ejemplo con Sequelize (ajústalo a tus modelos):
    // const db = require("../models");
    // const member = await db.Member.findOne({ where: { codigoCliente: client, codigoCampana: campaign }});
    // if (!member) return res.status(404).json({ message: "Miembro no encontrado" });

    // por ahora firmamos un token solo con los códigos
    const token = jwt.sign({ client, campaign }, SECRET, { expiresIn: "15m" });

    // Decide destino según el dispositivo
    if (isIOS(req.get("user-agent") || "")) {
      // iOS: genera/entrega .pkpass
      return res.redirect(`/api/wallet/ios/${token}`);
    } else {
      // Android/Desktop: Google Wallet
      return res.redirect(`/api/wallet/google/${token}`);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error interno" });
  }
};

exports.ios = async (req, res) => {
  try {
    const { token } = req.params;
    const payload = jwt.verify(token, SECRET);

    // TODO: genera el .pkpass real y haz res.download(...) o res.sendFile(...)
    return res.json({ ok: true, platform: "ios", payload });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: "Token inválido" });
  }
};

exports.google = async (req, res) => {
  try {
    const { token } = req.params;
    const payload = jwt.verify(token, SECRET);

    // TODO: crea el JWT para Google Wallet y redirige a pay.google.com/gp/v/save/<jwt>
    return res.json({ ok: true, platform: "google", payload });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: "Token inválido" });
  }
};
