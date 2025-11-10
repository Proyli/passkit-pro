// backend/src/routes/wallet_v2.js
// Minimally overrides wallet endpoints to:
// - Always include the new banner image
// - Hide visible member code
// - Keep tier-based color and info

const express = require("express");
const { pool } = require("../db");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

let PassLib = null;
try { PassLib = require("passkit-generator"); } catch {}
const PKPass = PassLib && (PassLib.PKPass || PassLib.Pass || PassLib.default);

const router = express.Router();

const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
const SECRET = process.env.WALLET_TOKEN_SECRET || "dev-secret";

const DEFAULT_KEY_PATH = "./keys/wallet-sa.json";
const KEY_PATH = process.env.GOOGLE_WALLET_KEY_PATH || DEFAULT_KEY_PATH;
let PRIVATE_KEY = null;
try {
  if (process.env.GOOGLE_WALLET_PRIVATE_KEY) {
    PRIVATE_KEY = String(process.env.GOOGLE_WALLET_PRIVATE_KEY).replace(/\\n/g, "\n");
  }
  if (!PRIVATE_KEY) {
    const raw = fs.readFileSync(KEY_PATH, "utf8");
    PRIVATE_KEY = JSON.parse(raw).private_key;
  }
} catch (e) {
  console.warn("[wallet_v2] No Google private key found:", e?.message || e);
}

function baseUrl() {
  const env = String(process.env.PUBLIC_BASE_URL || "").trim();
  return env.replace(/\/+$/, "");
}

function normalizeTier(s) {
  const t = String(s || "").toLowerCase();
  if (/(gold|oro|15)/.test(t)) return "gold";
  return "blue";
}

function heroUrl() {
  const envUrl = (process.env.GW_HERO || "").trim();
  if (envUrl) return envUrl;
  return `${baseUrl()}/public/0S2A8207.png`;
}

function infoText(tier) {
  return tier === "gold"
    ? (process.env.GW_INFO_GOLD || "Vive la experiencia premium con un 15% menos. Tu lealtad eleva cada brindis. Aplican restricciones.")
    : (process.env.GW_INFO_BLUE || "Disfruta un 5% de ahorro en cada compra. Tu lealtad suma. Aplican restricciones.");
}

function sanitize(s){ return String(s||"").replace(/[^\w.-]/g, "_"); }

function buildGoogleSaveUrl({ client, campaign, externalId, displayName, tierInput }) {
  if (!ISSUER_ID) throw new Error("Falta GOOGLE_WALLET_ISSUER_ID");
  if (!SA_EMAIL || !PRIVATE_KEY) throw new Error("Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY");

  const tier = normalizeTier(tierInput);
  const gold = tier === "gold";
  const displayId = String(externalId || client || "").trim();
  const barcodeValue = [client, campaign].filter(Boolean).join("-") || displayId;
  const labelTier = gold ? "GOLD 15%" : "BLUE 5%";
  const hero = heroUrl();
  const origin = baseUrl();
  const info = infoText(tier);

  const ver = process.env.WALLET_OBJECT_REV || "1";
  const objectId = `${ISSUER_ID}.${sanitize(`${displayId}-${(campaign||"").toLowerCase()}-${tier}-r${ver}`)}`;

  const classBlue = process.env.GW_CLASS_ID_BLUE || process.env.GOOGLE_WALLET_CLASS_ID_BLUE;
  const classGold = process.env.GW_CLASS_ID_GOLD || process.env.GOOGLE_WALLET_CLASS_ID_GOLD;
  const classId = gold ? (classGold || classBlue) : (classBlue || classGold);

  const loyaltyObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    hexBackgroundColor: gold ? "#DAA520" : "#2350C6",
    accountId:   displayId,
    accountName: displayName || displayId,
    infoModuleData: {
      labelValueRows: [
        { columns: [{ label: "Nombre", value: displayName || displayId }] },
        { columns: [{ label: "Información", value: info }] },
        { columns: [{ label: "Nivel", value: labelTier }] },
      ],
      showLastUpdateTime: false,
    },
    imageModulesData: [
      { id: "alcazaren_hero", mainImage: { sourceUri: { uri: hero }, contentDescription: { defaultValue: { language: "es", value: "Celebremos juntos" } } } }
    ],
    barcode: { type: "CODE_128", value: barcodeValue }, // sin alternateText para no mostrar el código
  };

  const payload = { loyaltyObjects: [loyaltyObject] };
  if (String(process.env.GW_DISABLE_ORIGINS || "").toLowerCase() !== "true") {
    payload.origins = [origin];
  }

  const saveToken = jwt.sign(
    { iss: SA_EMAIL, aud: "google", typ: "savetowallet", payload },
    PRIVATE_KEY,
    { algorithm: "RS256" }
  );
  return `https://pay.google.com/gp/v/save/${saveToken}`;
}

// ---- /wallet/resolve (override) ----
router.get("/wallet/resolve", async (req, res) => {
  try {
    const client = String(req.query.client || "").trim();
    const campaign = String(req.query.campaign || "").trim();
    const externalId = String(req.query.externalId || client || "").trim();
    const displayName = String(req.query.name || externalId || client || "").trim();
    const forced = String(req.query.platform || "").toLowerCase();

    const ua = String(req.get("user-agent") || "").toLowerCase();
    const isiOS = /iphone|ipad|ipod|macintosh/.test(ua);
    const tier = normalizeTier(req.query.tier);

    // Telemetría: registra SCAN (no bloquea si falla)
    try {
      const platform = isiOS ? 'apple' : /android|google/.test(ua) ? 'google' : 'unknown';
      await pool.query(
        `INSERT INTO telemetry_events (platform, source, event_type, user_agent, ip_address, createdAt)
         VALUES ($1, 'link', 'scan', $2, $3, NOW())`,
        [platform, ua, req.headers["x-forwarded-for"] || req.ip || null]
      );
    } catch (_) {}

    if (forced === "apple" || isiOS) {
      // delegate to ios token route with our token (also hides code)
      const token = jwt.sign({ client, campaign, externalId, name: displayName, tier }, SECRET, { expiresIn: "15m" });
      return res.redirect(302, `${baseUrl()}/api/wallet/ios/${token}`);
    }

    const saveUrl = buildGoogleSaveUrl({ client, campaign, externalId, displayName, tierInput: tier });
    return res.redirect(302, saveUrl);
  } catch (e) {
    console.error("[wallet_v2 resolve]", e?.message || e);
    return res.status(500).send("resolve failed");
  }
});

// ---- /wallet/google/:token (override) ----
router.get("/wallet/google/:token", async (req, res) => {
  try {
    const { client, campaign, externalId, name, tier } = jwt.verify(req.params.token, SECRET) || {};
    const saveUrl = buildGoogleSaveUrl({ client, campaign, externalId: externalId || client, displayName: name || externalId || client, tierInput: tier });
    return res.redirect(302, saveUrl);
  } catch (e) {
    console.error("[wallet_v2 google]", e?.message || e);
    return res.status(401).send("token invalid");
  }
});

// ---- /wallet/ios/:token (override) ----
router.get("/wallet/ios/:token", async (req, res) => {
  try {
    if (!PKPass) return res.status(500).type("text").send("passkit unavailable");

    const { client, campaign, externalId, name, tier: rawTier } = jwt.verify(req.params.token, SECRET) || {};
    const tier = normalizeTier(rawTier);
    const labelTier = tier === "gold" ? "GOLD 15%" : "BLUE 5%";
    const themeBg = tier === "gold" ? "rgb(218,165,32)" : "rgb(35,80,198)";

    const MODEL = process.env.MODEL_DIR ? path.resolve(process.env.MODEL_DIR) : path.resolve(__dirname, "../../passes/alcazaren.pass");
    const CERTS = process.env.CERT_DIR ? process.env.CERT_DIR : path.resolve(__dirname, "../../certs");

    const icon1x = path.join(MODEL, "icon.png");
    const icon2x = path.join(MODEL, "icon@2x.png");
    if (!fs.existsSync(icon1x) || !fs.existsSync(icon2x)) {
      return res.status(500).type("text").send("Faltan icon.png e icon@2x.png en MODEL_DIR");
    }

    const wwdr       = fs.readFileSync(path.join(CERTS, "wwdr.pem"));
    const signerCert = fs.readFileSync(path.join(CERTS, "signerCert.pem"));
    const signerKey  = fs.readFileSync(path.join(CERTS, "signerKey.pem"));

    const displayId = String(externalId || client || "").trim();
    const barcodeValue = [client, campaign].filter(Boolean).join("-") || displayId;
    const serial = `${sanitize(client)}-${sanitize(campaign)}-${tier}`;

    const pass = await PKPass.from(
      { model: MODEL, certificates: { wwdr, signerCert, signerKey, signerKeyPassphrase: process.env.APPLE_CERT_PASSWORD || undefined } },
      {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        teamIdentifier:     process.env.APPLE_TEAM_ID,
        organizationName:   process.env.APPLE_ORG_NAME || "Distribuidora Alcazaren",
        description:        "Tarjeta de Lealtad Alcazaren",
        serialNumber:       serial,
        webServiceURL: `${baseUrl()}/applews`,
        authenticationToken: process.env.APPLE_WS_TOKEN,
        foregroundColor: "rgb(255,255,255)",
        labelColor:      "rgb(255,255,255)",
        backgroundColor: themeBg,
        barcodes: [{ format: "PKBarcodeFormatCode128", message: String(barcodeValue || "").normalize("NFKD").replace(/[^\x00-\x7F]/g, ""), messageEncoding: "iso-8859-1" }],
        storeCard: {
          headerFields:    [{ key: "tier", label: "Nivel", value: labelTier }],
          primaryFields:   [{ key: "name", label: "Nombre", value: String(name || displayId) }],
          secondaryFields: [], // sin “Código” visible
          auxiliaryFields: [{ key: "info", label: "Información", value: infoText(tier) }],
        }
      }
    );

    const buffer = await pass.getAsBuffer();
    res.set({ "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="${sanitize(serial)}.pkpass"`, "Cache-Control": "no-store" });
    return res.send(buffer);
  } catch (e) {
    console.error("[wallet_v2 ios]", e?.message || e);
    return res.status(500).type("text").send(e?.message || "pkpass error");
  }
});

module.exports = router;
