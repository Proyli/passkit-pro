const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../src/db");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");

const router = express.Router();
const SECRET = process.env.WALLET_TOKEN_SECRET || "changeme";

/* ============ AUTH PARA WALLET OBJECTS API ============ */
async function getWalletClient() {
  const keyPath = process.env.GOOGLE_WALLET_KEY_PATH || "./keys/wallet-sa.json";
  const sa = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const auth = new GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
  return auth.getClient();
}

/* ============ CREAR/VERIFICAR LOYALTY CLASS ============ */
async function ensureLoyaltyClassExists(client, classRef, issuerId, programName) {
  try {
    await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${classRef}`,
      method: "GET",
    });
    // Ya existe
  } catch (e) {
    if (e?.response?.status !== 404) throw e;

    const logoUri = process.env.GOOGLE_WALLET_PROGRAM_LOGO;
    if (!logoUri) throw new Error("Falta GOOGLE_WALLET_PROGRAM_LOGO en .env");

    await client.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass",
      method: "POST",
      data: {
        id: classRef,                          // issuerId.classId
        issuerName: `Issuer ${issuerId}`,
        programName: programName || "Lealtad Alcazarén",
        reviewStatus: "DRAFT",
        programLogo: {                          // Logo requerido
          sourceUri: { uri: logoUri }
        }
      },
    });
  }
}

/* ============ CREAR/VERIFICAR LOYALTY OBJECT ============ */
async function ensureLoyaltyObjectExists(client, obj) {
  try {
    await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${obj.id}`,
      method: "GET",
    });
    console.log("loyaltyObject ya existía:", obj.id);
  } catch (e) {
    if (e?.response?.status !== 404) throw e;

    const r = await client.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject",
      method: "POST",
      data: obj,
    });
    console.log("loyaltyObject creado:", r.data?.id);
  }
}

/* ============ PICK PLATFORM ============ */
function pickPlatform(req) {
  const q = String(req.query.platform || "").toLowerCase();
  if (q === "ios" || q === "apple") return "ios";
  if (q === "google" || q === "android") return "google";
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  return /(iphone|ipad|ipod)/.test(ua) ? "ios" : "google";
}

/* ============ /wallet/resolve (redirige según plataforma) ============ */
router.get("/wallet/resolve", async (req, res) => {
  const client = String(req.query.client || "").trim();
  const campaign = String(req.query.campaign || "").trim();

  if (!client || !campaign) {
    return res.status(400).json({ message: "client & campaign requeridos" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
          id,
          codigoCliente       AS clientCode,
          \`codigoCampana\`    AS campaignCode,
          nombre, apellido, email, telefono,
          tipoCliente, genero, puntos, fechaNacimiento
      FROM members
      WHERE codigoCliente = ?
        AND \`codigoCampana\` = ?
      LIMIT 1
      `,
      [client, campaign]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Miembro no encontrado" });
    }

    const m = rows[0];
    const member = {
      id: m.id,
      clientCode: m.clientCode,
      campaignCode: m.campaignCode,
      name: [m.nombre, m.apellido].filter(Boolean).join(" "),
      email: m.email,
      phone: m.telefono,
      tier: m.tipoCliente,
      points: Number(m.puntos || 0),
    };

    const token = jwt.sign(
      { id: member.id, client: member.clientCode, campaign: member.campaignCode },
      SECRET,
      { expiresIn: "15m" }
    );

    const dest = pickPlatform(req); // "ios" o "google"
    return res.redirect(302, `/api/wallet/${dest}/${token}`);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error interno", error: String(e?.message || e) });
  }
});

/* ============ iOS: por ahora sirve pkpass de prueba ============ */
router.get("/wallet/ios/:token", (req, res) => {
  try {
    jwt.verify(req.params.token, SECRET);
    return res.redirect(302, "/public/sample.pkpass");
  } catch {
    return res.status(400).json({ message: "Token inválido" });
  }
});

/* ============ GOOGLE: crea/verifica class + object y firma JWT ============ */
router.get("/wallet/google/:token", async (req, res) => {
  try {
    // 1) Verificamos el token corto nuestro (client, campaign)
    const payloadShort = jwt.verify(req.params.token, SECRET);
    const client = String(payloadShort.client || "").trim();
    const campaign = String(payloadShort.campaign || "").trim();
    if (!client || !campaign) {
      return res.status(400).json({ message: "Payload incompleto" });
    }

    // 2) Credencial SA (para firmar JWT)
    const keyPath = process.env.GOOGLE_WALLET_KEY_PATH || "./keys/wallet-sa.json";
    const sa = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    const privateKey  = sa.private_key;
    const clientEmail = sa.client_email;

    // 3) IDs (issuerId.classId)
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    const classId  = process.env.GOOGLE_WALLET_CLASS_ID;
    const classRef = `${issuerId}.${classId}`;
    console.log("Wallet cfg", { issuerId, classId, classRef });

    // 4) Asegurar Class con logo
    const clientApi = await getWalletClient();
    await ensureLoyaltyClassExists(clientApi, classRef, issuerId, "Lealtad Alcazarén");

    // 5) Objeto único por cliente y campaña
    const objId = `${issuerId}.${client}-${campaign}`.replace(/[^A-Za-z0-9._-]/g, "_");

    const loyaltyObject = {
      id: objId,
      classId: classRef,
      state: "ACTIVE",
      barcode: { type: "QR_CODE", value: `PK|${client}|${campaign}` },
      textModulesData: [
        { header: "Cliente", body: client },
        { header: "Campaña", body: campaign }
      ],
      cardTitle: { defaultValue: { language: "es", value: "Lealtad Alcazarén" } }
    };

    // 6) Asegurar Object
    await ensureLoyaltyObjectExists(clientApi, loyaltyObject);

    // 7) Firmar JWT Save-to-Wallet SOLO con el id del object
    const claims = {
      iss: clientEmail,
      aud: "google",
      typ: "savetowallet",
      payload: {
        loyaltyObjects: [{ id: objId }]
      }
    };

    const signedJwt = jwt.sign(claims, privateKey, { algorithm: "RS256" });

    // 8) Redirigir a Google
    return res.redirect(`https://pay.google.com/gp/v/save/${signedJwt}`);
  } catch (err) {
    console.error("Wallet Google error:", err?.response?.data || err?.message || err);
    return res
      .status(400)
      .json({
        message: "Token inválido o firma falló",
        error: String(err?.response?.data?.error?.message || err?.message || err)
      });
  }
});

module.exports = router;
