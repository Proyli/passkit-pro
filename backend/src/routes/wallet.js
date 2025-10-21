// src/routes/wallet.js
const { classIdForTier } = require("../helpers/tier");
const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const fs = require("fs");
const path = require("path");
const { sendMailSmart } = require("../mailer");
const { renderWalletEmail, mergeSettings } = require("../../services/renderEmail");
const crypto = require("crypto");

// ===================== Passkit (Apple) =====================
let _passlib;
try {
  _passlib = require("passkit-generator");
} catch (e) {
  console.error("❌ No se pudo cargar 'passkit-generator':", e?.message || e);
  _passlib = {};
}
const Pass =
  _passlib.Pass ||
  _passlib.PKPass ||
  _passlib.default ||
  null;

if (!Pass || typeof Pass.from !== "function") {
  console.error("❌ 'passkit-generator' no expone Pass.from/PKPass.from. Revisa versión instalada.");
}

// ===================== Paths / Modelo =====================
const CERTS = process.env.CERT_DIR
  ? process.env.CERT_DIR                 // Render: /etc/secrets
  : path.resolve(__dirname, "../../certs"); // Local

const MODEL = process.env.MODEL_DIR
  ? path.resolve(process.env.MODEL_DIR)
  : path.resolve(__dirname, "../../passes/alcazaren.pass");

console.log("[wallet] CERTS =", CERTS);
console.log("[wallet] MODEL =", MODEL);
["wwdr.pem","signerCert.pem","signerKey.pem"].forEach(f=>{
  console.log(`[wallet] exists ${f}?`, fs.existsSync(path.join(CERTS,f)));
});
console.log("[wallet] model exists?", fs.existsSync(MODEL));

// ===================== Utils =====================
const sanitize = (s) => String(s).replace(/[^\w.-]/g, "_");

function baseUrl() {
  const env = String(process.env.PUBLIC_BASE_URL || "").trim();
  return env.replace(/\/+$/, "");
}

const GOLD_HEX  = "#DAA520";      // Google
const BLUE_HEX  = "#2350C6";
const GOLD_RGB  = "rgb(218,165,32)"; // Apple
const BLUE_RGB  = "rgb(35,80,198)";

function isGoldTier(t) {
  return /(gold|golden|dorado|oro|15)/i.test(String(t || ""));
}

function getHeroUrl() {
  const envUrl = (process.env.GW_HERO || "").trim();
  if (envUrl) return envUrl;
  return `${baseUrl()}/public/hero-alcazaren.jpeg`;
}

// Reemplaza tu normalizeTier y tierFromAll por esto:

function normalizeTier(s, { loose = false } = {}) {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return "";

  // exacto (para query/body)
  const exactGold = /^(gold|golden|dorado|oro|15|15%)$/i;
  const exactBlue = /^(blue|azul|5|5%)$/i;

  // flexible (para BD: admite "gold 15%", "gold - 15%", etc.)
  const looseGold = /(gold|golden|dorado|oro|15)/i;
  const looseBlue = /(blue|azul|5)/i;

  if (loose ? looseGold.test(t) : exactGold.test(t)) return "gold";
  if (loose ? looseBlue.test(t) : exactBlue.test(t)) return "blue";
  return "";
}

// DB -> query -> body -> blue
function tierFromAll({ tipoCliente, queryTier, bodyTier }) {
 /* return (
    normalizeTier(tipoCliente, { loose: true }) || // <- BD flexible ("Gold 15%")
    normalizeTier(queryTier) ||                    // <- exacto
    normalizeTier(bodyTier)  ||                    // <- exacto
    "blue"
  );*/
  // Precedencia: body > query > DB (el frontend debe poder forzar el tier via body)
  const fromBody  = normalizeTier(bodyTier);
  const fromQuery = normalizeTier(queryTier);
  const fromDb    = normalizeTier(tipoCliente, { loose: true }); // BD puede contener texto extra
  const finalTier = fromBody || fromQuery || fromDb || "blue";
  console.log("[tierFromAll] inputs:", { tipoCliente, queryTier, bodyTier }, "normalized:", { fromBody, fromQuery, fromDb, finalTier });
  return finalTier;
}

function getInfoText(tier) {
  const t = String(tier || "").toLowerCase();
  if (t === "gold") {
    return (
      process.env.GW_INFO_GOLD ||
      "Vive la experiencia premium con un 15% menos.\nTu lealtad eleva cada brindis.\n\nAplican restricciones."
    );
  }
  return (
    process.env.GW_INFO_BLUE ||
    "Ahorra en cada compra y acumula beneficios.\nTu lealtad suma.\n\nAplican restricciones."
  );
}

function formatFrontInfo(infoText, { maxLines = 2, maxChars = 110 } = {}) {
  if (!infoText) return "";

  const normalizedLines = String(infoText)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!normalizedLines.length) return "";

  const compact = normalizedLines.slice(0, maxLines).join(" • ");

  if (compact.length <= maxChars) return compact;

  const truncated = compact.slice(0, maxChars).replace(/[\s•]+$/u, "");
  return `${truncated}…`;
}

function getDisplayName(row) {
  if (!row) return null;
  const f = row.firstname ?? row.first_name ?? row.nombre ?? row.name ?? "";
  const l = row.lastname  ?? row.last_name  ?? row.apellido ?? "";
  const full = `${String(f||"").trim()} ${String(l||"").trim()}`.trim();
  return full || null;
}

function buildClientCampaignCode(client, campaign) {
  const clientCode = String(client || "").trim();
  const campaignCode = String(campaign || "").trim();
  if (clientCode && campaignCode) return `${clientCode}-${campaignCode}`;
  return clientCode || campaignCode;
}

// ===================== ENV Google =====================
const SA_EMAIL  = process.env.GOOGLE_SA_EMAIL; // wallet-svc@...iam.gserviceaccount.com
const SECRET    = process.env.WALLET_TOKEN_SECRET || "changeme";
const SKIP_DB   = process.env.SKIP_DB === "true";

console.log("[wallet] SECRET prefix:", String(SECRET || "none").slice(0, 10));

// ---- Service Account private key (var o archivo) ----
const DEFAULT_KEY_PATH = "./keys/wallet-sa.json";
const KEY_PATH = process.env.GOOGLE_WALLET_KEY_PATH || DEFAULT_KEY_PATH;

let PRIVATE_KEY = null;
// 1) variable
if (process.env.GOOGLE_WALLET_PRIVATE_KEY) {
  try {
    const raw = process.env.GOOGLE_WALLET_PRIVATE_KEY.trim();
    PRIVATE_KEY = raw.includes("BEGIN PRIVATE KEY")
      ? raw
      : JSON.parse(raw).private_key;
  } catch (e) {
    console.error("❌ GOOGLE_WALLET_PRIVATE_KEY inválida:", e.message);
  }
}
// 2) archivo
if (!PRIVATE_KEY) {
  try {
    const resolved = fs.existsSync(KEY_PATH) ? KEY_PATH : DEFAULT_KEY_PATH;
    const fileRaw = fs.readFileSync(resolved, "utf8");
    PRIVATE_KEY = JSON.parse(fileRaw).private_key;
  } catch (e) {
    console.error("❌ No pude leer private_key:", e.message);
  }
}
if (!PRIVATE_KEY) console.warn("⚠️  PRIVATE_KEY vacío. Google Wallet fallará.");

const router = express.Router();


// ===================== Salud =====================
router.get("/healthz", (req, res) => {
  res.set("x-app-rev", process.env.WALLET_OBJECT_REV || "dev");
  res.status(200).send("ok");
});


// ===================== DB Helper =====================
async function tryQuery(sql, params) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (e) {
    if (e?.code === "ER_BAD_FIELD_ERROR") return null; // columna no existe; probamos otra
    throw e;
  }
}

async function findMemberFlexible(client, campaign) {
  const clientCode = String(client || "").trim();
  const campaignCode = String(campaign || "").trim();

  if (SKIP_DB) return null;

  // 1) camelCase
  let rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name, tipoCliente, codigoCliente, codigoCampana
       FROM members WHERE codigoCliente=? AND codigoCampana=? LIMIT 1`,
    [clientCode, campaignCode]
  );
  if (rows?.[0]) return rows[0];

  // 2) sólo cliente (camelCase)
  rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name, tipoCliente, codigoCliente
       FROM members WHERE codigoCliente=? LIMIT 1`,
    [clientCode]
  );
  if (rows?.[0]) return rows[0];

  // 3) snake_case
  rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name,
            tipo_cliente AS tipoCliente, codigo_cliente AS codigoCliente, codigo_campana AS codigoCampana
       FROM members WHERE codigo_cliente=? AND codigo_campana=? LIMIT 1`,
    [clientCode, campaignCode]
  );
  if (rows?.[0]) return rows[0];

  // 4) sólo cliente (snake_case)
  rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name,
            tipo_cliente AS tipoCliente, codigo_cliente AS codigoCliente
       FROM members WHERE codigo_cliente=? LIMIT 1`,
    [clientCode]
  );
  return rows?.[0] || null;
}


// ===================== Google: construir Save URL =====================
function buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier }) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuer) throw new Error("Falta GOOGLE_WALLET_ISSUER_ID");
  if (!SA_EMAIL || !PRIVATE_KEY) throw new Error("Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY");

  const clientCode = String(client || "").trim();
  const campaignCode = String(campaign || "").trim();
  const displayId = String(externalId || clientCode || "").trim();
  if (!displayId) throw new Error("No hay código para el miembro.");
  const barcodeValue = buildClientCampaignCode(clientCode, campaignCode);
  if (!barcodeValue) throw new Error("No hay código de barras para el miembro.");

  /*const rawTier  = String(tier || "");
  const gold     = /(gold|golden|dorado|oro|15)/i.test(rawTier);
  const tierNorm = gold ? "gold" : "blue";*/
   // Normalizar el tier aquí de forma permisiva (acepta "Gold 15%", "gold", etc.)
  const tierNorm = normalizeTier(tier, { loose: true }) || "blue";
  const gold = tierNorm === "gold";
  console.log("[buildGoogleSaveUrl] tier input:", tier, "=> tierNorm:", tierNorm, "gold:", gold);
  console.log("[buildGoogleSaveUrl] ids:", { client: clientCode, campaign: campaignCode, displayId, barcodeValue });

  const tierLabel = gold ? "GOLD 15%" : "BLUE 5%";   // <- ¡vuelve!
  const verTag   = process.env.WALLET_OBJECT_REV || "2";

  const heroUri  = getHeroUrl();
  const origin   = baseUrl();

  const infoTextFull = getInfoText(tierNorm);
  const infoFront = infoTextFull
    ? infoTextFull
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
    : "";

  // ID nuevo para forzar refresco en el teléfono
  const objectId = `${issuer}.${sanitize(
    `${displayId}-${(campaignCode || "").toLowerCase()}-${tierNorm}-r${verTag}`
  )}`;

  // Clase correcta por tier (intenta helper, luego fallbacks desde env)
  let classRef = classIdForTier(tierNorm);
  // Fallbacks por si helpers/tier devuelve una clase inesperada o vacía
  const envGold = process.env.GW_CLASS_ID_GOLD || process.env.GOOGLE_WALLET_CLASS_ID_GOLD || null;
  const envBlue = process.env.GW_CLASS_ID_BLUE || process.env.GOOGLE_WALLET_CLASS_ID_BLUE || null;
  if (!classRef || (tierNorm === "gold" && /blue/i.test(String(classRef)))) {
    classRef = envGold || classRef;
  }
  if (!classRef || (tierNorm === "blue" && /gold/i.test(String(classRef)))) {
    classRef = envBlue || classRef;
  }
  if (!envGold && !envBlue) console.log('[GW] no GW/GOOGLE class envs found; classIdForTier will use GOOGLE_WALLET_CLASS_ID if present');
  console.log("[GW] class pick:", { objectId, tierNorm, classRef, envGold, envBlue });

  // Objeto con color forzado por tier
  const loyaltyObject = {
    id: objectId,
    classId: classRef,
    state: "ACTIVE",
    hexBackgroundColor: gold ? "#DAA520" : "#2350C6",

    accountId:   displayId,
    accountName: displayName || displayId,

    infoModuleData: {
      labelValueRows: [
        { columns: [{ label: "Nombre", value: displayName || displayId }] },
        ...(infoFront
          ? [{ columns: [{ label: "Información", value: infoFront }] }]
          : []),
        { columns: [{ label: "Nivel", value: tierLabel }] },   // <- ya no rompe
        { columns: [{ label: "Código", value: displayId }] }
      ],
      showLastUpdateTime: false
    },

    imageModulesData: [
      {
        id: "alcazaren_hero",
        mainImage: {
          sourceUri: { uri: heroUri },
          contentDescription: {
            defaultValue: { language: "es", value: "Celebremos juntos" }
          }
        }
      }
    ],
    textModulesData: [
      {
        id: "alcazaren_info",
        header: "Información",
        body: infoTextFull
      }
    ],
    linksModuleData:  { uris: [{ uri: `${origin}/public/terminos`, description: "Términos y condiciones" }] },
    barcode: { type: "CODE_128", value: barcodeValue, alternateText: displayId },
  };


  const saveToken = jwt.sign(
    { iss: SA_EMAIL, aud: "google", typ: "savetowallet", payload: { loyaltyObjects: [loyaltyObject], origins: [origin] } },
    PRIVATE_KEY, { algorithm: "RS256" }
  );
  return `https://pay.google.com/gp/v/save/${saveToken}`;
}


// ===================== iOS (.pkpass) =====================
router.get("/wallet/ios/:token", async (req, res) => {
  try {
    const tokenPayload = jwt.verify(req.params.token, SECRET);
    const client = String(tokenPayload.client || "").trim();
    const campaign = String(tokenPayload.campaign || "").trim();
    const tokenExternalId = tokenPayload.externalId;
    const tokenName = tokenPayload.name;
    const tokenTier = tokenPayload.tier;

    // Datos del miembro
    let externalId  = tokenExternalId || client;
    let displayName = tokenName || client;
    let tipoCliente = null;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        if (!tokenExternalId && r.external_id) {
          externalId = r.external_id;
        } else {
          externalId = externalId || r.external_id || client;
        }
        if (!tokenName && getDisplayName(r)) {
          displayName = getDisplayName(r);
        } else {
          displayName = displayName || getDisplayName(r) || client;
        }
        tipoCliente = r.tipoCliente || null;
      }
    } catch {}

    if (req.query?.name) {
      displayName = String(req.query.name).trim();
    }

    if (req.query?.externalId) {
      const trimmed = String(req.query.externalId).trim();
      if (trimmed) externalId = trimmed;
    }

    if (!externalId) externalId = client;
    if (!displayName) displayName = externalId || client;

    // Modelo e iconos mínimos
    const icon1x = path.join(MODEL, "icon.png");
    const icon2x = path.join(MODEL, "icon@2x.png");
    if (!fs.existsSync(icon1x) || !fs.existsSync(icon2x)) {
      return res.status(500).type("text").send("Faltan icon.png e icon@2x.png en MODEL_DIR");
    }

    // Certificados
    const wwdr       = fs.readFileSync(path.join(CERTS, "wwdr.pem"));
    const signerCert = fs.readFileSync(path.join(CERTS, "signerCert.pem"));
    const signerKey  = fs.readFileSync(path.join(CERTS, "signerKey.pem"));

      // 👉 iOS: primero query ?tier= , luego BD, luego blue
    const tier =
      normalizeTier(req.query.tier) ||
      normalizeTier(tokenTier) ||
      normalizeTier(tipoCliente, { loose: true }) ||
      "blue";

    console.log("[ios-pass] tier:", {
      query: req.query.tier,
      db: tipoCliente,
      final: tier
    });

    const tierLabel = tier === "gold" ? "GOLD 15%" : "BLUE 5%";
    const theme = (tier === "gold")
      ? { bg: GOLD_RGB, fg: "rgb(255,255,255)", label: "rgb(255,255,255)" }
      : { bg: BLUE_RGB, fg: "rgb(255,255,255)", label: "rgb(255,255,255)" };

    // Serial incluye tier para forzar refresco si cambias color
    const displayId = String(externalId || client || "").trim();
    const barcodeValue = buildClientCampaignCode(client, campaign) || displayId;
    console.log("[ios-pass] ids:", { client, campaign, displayId, barcodeValue });
    const serial = `${sanitize(client)}-${sanitize(campaign)}-${tier}`;

    const infoTextFull = getInfoText(tier);
    const infoFront = infoTextFull
      ? infoTextFull
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join(" ")
      : "";

    const pass = await Pass.from(
      {
        model: MODEL,
        certificates: {
          wwdr,
          signerCert,
          signerKey,
          signerKeyPassphrase: process.env.APPLE_CERT_PASSWORD || undefined,
        },
      },
      {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        teamIdentifier:     process.env.APPLE_TEAM_ID,
        organizationName:   process.env.APPLE_ORG_NAME || "Distribuidora Alcazaren",
        description:        "Tarjeta de Lealtad Alcazaren",
        serialNumber:       serial,

        webServiceURL: `${baseUrl()}/applews`,
        authenticationToken: process.env.APPLE_WS_TOKEN,

        foregroundColor: theme.fg,
        labelColor:      theme.label,
        backgroundColor: theme.bg, // 🔥 Apple usa RGB

        // Código de barras
        barcodes: [{
          format: "PKBarcodeFormatCode128",
          message: String(barcodeValue || "").normalize("NFKD").replace(/[^\x00-\x7F]/g, ""),
          messageEncoding: "iso-8859-1",
          altText: displayId, // se ve debajo
        }],

        // Campos visibles
        storeCard: {
          headerFields:    [{ key: "tier", label: "Nivel", value: tierLabel }],
          primaryFields:   [{ key: "name", label: "Nombre", value: displayName }],
          secondaryFields: [{ key: "code", label: "Código", value: displayId }],
          auxiliaryFields: infoFront
            ? [{ key: "info", label: "Información", value: infoFront }]
            : []
        }
      }
    );

    // Texto al dorso
    if (infoTextFull) {
      pass.backFields = [{ key: "info", label: "Información", value: infoTextFull }];
    }

    // Responder .pkpass
    const buffer = await pass.getAsBuffer();
    res.set({
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${sanitize(serial)}.pkpass"`,
      "Cache-Control": "no-store"
    });
    return res.send(buffer);
  } catch (e) {
    console.error("ios pkpass error:", e?.message || e);
    return res.status(500).type("text").send(e?.message || "pkpass error");
  }
});

// ===================== Resolve (UA / platform) =====================
router.get("/wallet/resolve", async (req, res) => {
  try {
    const client   = String(req.query.client   || "").trim();
    const campaign = String(req.query.campaign || "").trim();
    const forced   = String(req.query.platform || "").toLowerCase();
    if (!client || !campaign) return res.status(400).send("missing client/campaign");

    const ua    = String(req.get("user-agent") || "");
    const isiOS = /iPhone|iPad|iPod/i.test(ua);

    // Enriquecer datos
    let externalId  = client;
    let displayName = client;
    let tipoCliente = null;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId  = r.external_id || client;
        displayName = getDisplayName(r) || client;
        tipoCliente = r.tipoCliente || null;
      }
    } catch {}
    // override desde query/body si viene del frontend
    if (req.query?.externalId) {
      const trimmed = String(req.query.externalId).trim();
      if (trimmed) externalId = trimmed;
    }
    if (req.query?.name || req.body?.name) {
      displayName = String(req.query.name || req.body.name).trim();
    }

console.log("[resolve] using:", { client, campaign, externalId, displayName, tipoCliente });
 
    const tier = tierFromAll({
      tipoCliente,
      campaign,
      queryTier: req.query?.tier,
      bodyTier:  req.body?.tier
    });

    // iOS → .pkpass
    if (forced === "apple" || isiOS) {
      const iosPayload = { client, campaign };
      if (externalId) iosPayload.externalId = externalId;
      if (displayName) iosPayload.name = displayName;
      if (tier) iosPayload.tier = tier;
      const iosToken  = jwt.sign(iosPayload, SECRET, { expiresIn: "15m" });
      const qs = [];
      if (req.query.tier) qs.push(`tier=${encodeURIComponent(req.query.tier)}`);
      if (req.query.name) qs.push(`name=${encodeURIComponent(req.query.name)}`);
      const extra = qs.length ? `?${qs.join("&")}` : "";
      const appleUrl  = `${baseUrl()}/api/wallet/ios/${iosToken}${extra}`;
      return res.redirect(302, appleUrl);
    }

    console.log("[resolve]", { client, campaign, tipoCliente, tier, classRef: classIdForTier(tier) });

    const saveUrl = buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier });
    return res.redirect(302, saveUrl);
  } catch (e) {
    console.error("wallet/resolve error:", e?.message || e);
    return res.status(500).send("resolve failed");
  }
});

// ===================== Compat: Google con token =====================
router.get("/wallet/google/:token", async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, SECRET);
    const client = String(decoded.client || "").trim();
    const campaign = String(decoded.campaign || "").trim();

    if (!process.env.GOOGLE_WALLET_ISSUER_ID) {
      return res.status(500).json({ message: "Falta GOOGLE_WALLET_ISSUER_ID" });
    }
    if (!SA_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ message: "Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY" });
    }

    // DB
    let externalId  = client;
    let displayName = client;
    let tipoCliente = null;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId  = r.external_id || client;
        displayName = getDisplayName(r) || client;
        tipoCliente = r.tipoCliente || null;
      }
    } catch {}

    const tier = tierFromAll({ tipoCliente, campaign, queryTier: req.query.tier });
    const saveUrl = buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier });
    return res.redirect(302, saveUrl);
  } catch (e) {
    console.error("wallet/google error:", e?.message || e);
    return res.status(401).json({ message: "Token inválido/vencido o error en Google Wallet", details: e?.message });
  }
});

// ===================== Vista códigos (opcional) =====================
router.get("/wallet/codes", async (req, res) => {
  const client   = String(req.query.client || "");
  const campaign = String(req.query.campaign || "");
  let value = String(req.query.value || "");

  if (!value && client && campaign) {
    try {
      if (!SKIP_DB) {
        const [rows] = await pool.query(
          `SELECT external_id FROM members WHERE codigoCliente=? AND \`codigoCampana\`=? LIMIT 1`,
          [client, campaign]
        );
        value = rows?.[0]?.external_id || `PK|${client}|${campaign}`;
      } else {
        value = `PK|${client}|${campaign}`;
      }
    } catch {
      value = `PK|${client}|${campaign}`;
    }
  }
  if (!value) return res.status(400).send("missing value or client/campaign");

  const barcodeImg = `${baseUrl()}/api/barcode/${encodeURIComponent(value)}.png`;

  res.send(`<!doctype html>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Tu código</title>
  <style>
    :root { --pad:16px; --maxW:1100px; }
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#111;font:16px system-ui,-apple-system,Segoe UI,Roboto}
    .wrap{min-height:100svh;display:flex;flex-direction:column;align-items:center;gap:12px;padding:var(--pad)}
    .bar{width:100%;max-width:var(--maxW);display:flex;gap:8px;align-items:center;justify-content:space-between}
    .left{display:flex;gap:8px;align-items:center}
    .tab, .btn{border:1px solid #ddd;background:#f8f8f8;padding:10px 14px;border-radius:10px;cursor:pointer}
    .tab.active{background:#111;color:#fff;border-color:#111}
    .canvas{width:100%;max-width:var(--maxW);display:flex;align-items:center;justify-content:center}
    #qr, #bar{display:none}
    #qr.show, #bar.show{display:block}
    #qr > canvas, #qr > img{width:min(92vw,760px);height:auto}
    #bar{width:min(96vw,1200px);height:auto;image-rendering:crisp-edges}
    .hint{font:600 13px system-ui;color:#444;text-align:center}
    .val{margin-top:6px;font:600 16px system-ui;color:#222;text-align:center;word-break:break-all}
  </style>
  <div class="wrap">
    <div class="bar">
      <div class="left">
        <button id="tabQr"  class="tab active">QR</button>
        <button id="tabBar" class="tab">Barras</button>
      </div>
      <div class="right">
        <button id="btnFS" class="btn">Pantalla completa</button>
      </div>
    </div>
    <div class="hint">Sube el brillo al máximo. Si el lector es exigente, usa <b>Pantalla completa</b>.</div>
    <div class="canvas">
      <div id="qr" class="show"></div>
      <img id="bar" alt="Código de barras" src="${barcodeImg}">
    </div>
    <div class="val">${value}</div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    const value = ${JSON.stringify(value)};
    const qr = new QRCode(document.getElementById('qr'), {
      text: value, width: 760, height: 760, correctLevel: QRCode.CorrectLevel.M
    });
    const elQr  = document.getElementById('qr');
    const elBar = document.getElementById('bar');
    const tabQr  = document.getElementById('tabQr');
    const tabBar = document.getElementById('tabBar');
    function show(which){
      if(which === 'qr'){
        elQr.classList.add('show'); elBar.classList.remove('show');
        tabQr.classList.add('active'); tabBar.classList.remove('active');
      } else {
        elBar.classList.add('show'); elQr.classList.remove('show');
        tabBar.classList.add('active'); tabQr.classList.remove('active');
      }
      document.body.addEventListener('click', goFS, {once:true});
      document.body.addEventListener('touchstart', goFS, {once:true});
    }
    tabQr.onclick = () => show('qr');
    tabBar.onclick = () => show('bar');
    const btnFS = document.getElementById('btnFS');
    const goFS = () => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(()=>{});
    btnFS.onclick = goFS;
    show('bar');
  </script>`);
});

// ===================== Email con Smart Link =====================

// ===================== Email con Smart Link =====================
router.post("/wallet/email", async (req, res) => {
  try {
    const client   = String(req.body.client   || "").trim();
    const campaign = String(req.body.campaign || "").trim();
    const to       = String(req.body.to       || "");
    if (!client || !campaign || !to) {
      return res.status(400).json({ ok:false, message:"Falta client/campaign/to" });
    }

    // Buscar datos del miembro
    let externalId   = null;
    let displayName  = client;
    let tipoCliente  = null;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId   = r.external_id || null;
        displayName  = getDisplayName(r) || client;
        tipoCliente  = r.tipoCliente || null;
      }
    } catch {}

    // 🔥 Fallback: permite forzar por body y si aún no hay, usa el client
    const extFromBody = String(req.body.externalId || req.body.external_id || "").trim();
    externalId = extFromBody || externalId || client;

    // Tier: body > DB > blue
    //const inputTier = normalizeTier(req.body.tier);
    //const tierParam = inputTier || normalizeTier(tipoCliente) || "blue";

     const inputTier = normalizeTier(req.body.tier);
  // La BD puede tener valores como "Gold 15%"; usar versión flexible (loose)
    const tierFromDb = normalizeTier(tipoCliente, { loose: true });
    const tierParam = inputTier || tierFromDb || "blue";
    console.log("[email] tier inputs:", { inputTier, tipoCliente, tierFromDb, tierFinal: tierParam });
 // ...existing code...
    // Nombre opcional desde body
    if (req.body.name) displayName = String(req.body.name).trim() || displayName;

  // Smart link: include tier inside the signed token so it cannot be tampered with
  const tokenPayload = { client, campaign, tier: tierParam };
  if (externalId) tokenPayload.externalId = externalId;
  if (displayName) tokenPayload.name = displayName;
  const token = jwt.sign(tokenPayload, SECRET, { expiresIn: "2d" });
  const nameParam = displayName ? `?name=${encodeURIComponent(displayName)}` : "";
  // Note: tier is preserved inside the token; no need to add it to the query string
  const smartUrl = `${baseUrl()}/api/wallet/smart/${token}${nameParam}`;

    console.log("[email] SMART_URL =>", smartUrl, "| ext=", externalId, "| tierFinal=", tierParam);

    const settings = mergeSettings();
    const html = renderWalletEmail(settings, {
      displayName,
      membershipId: externalId,
      smartUrl,
    });

    const stamp     = new Date().toISOString().replace(/[:T]/g, "-").slice(0,16);
    const subject   = `${settings.subject} • ${displayName || externalId} • ${stamp}`;
    const messageId = `<${crypto.randomBytes(9).toString("hex")}@alcazaren.com.gt>`;

    await sendMailSmart({
      to, subject, html,
      text:
        `Su Tarjeta de Lealtad\n\n` +
        `Hola ${displayName || ""}, guarde su tarjeta en su billetera digital.\n\n` +
        `Añadir a mi Wallet: ${smartUrl}\n\n` +
        `Este es un correo automático. No responda a este mensaje.`,
      messageId,
      headers: { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" },
    });

    return res.status(200).json({ ok:true, to, smartUrl });
  } catch (e) {
    console.error("send wallet email error:", e?.message || e);
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});

// ===================== Smart link UA =====================
router.get("/wallet/smart/:token", async (req, res) => {
  try {
    const tokenPayload = jwt.verify(req.params.token, SECRET) || {};
    const {
      client: rawClient,
      campaign: rawCampaign,
      tier: tokenTier,
      externalId: tokenExternalId,
      name: tokenName,
    } = tokenPayload;
    const client = String(rawClient || "").trim();
    const campaign = String(rawCampaign || "").trim();
    console.log('[smart] tokenPayload:', tokenPayload, 'queryTier:', req.query?.tier);
    const ua = String(req.get("user-agent") || "").toLowerCase();
    const isApple = /iphone|ipad|ipod|macintosh/.test(ua);

    // Enriquecer
    let externalId  = tokenExternalId || client;
    let displayName = tokenName || client;
    let tipoCliente = null;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        if (!tokenExternalId && r.external_id) {
          externalId = r.external_id;
        } else {
          externalId = externalId || r.external_id || client;
        }
        if (!tokenName && getDisplayName(r)) {
          displayName = getDisplayName(r);
        } else {
          displayName = displayName || getDisplayName(r) || client;
        }
        tipoCliente = r.tipoCliente || null;
      }
    } catch {}

    const nameOverride = req.query?.name || req.body?.name || null;
    if (nameOverride) {
      const trimmed = String(nameOverride).trim();
      if (trimmed) displayName = trimmed;
    }

    const externalOverride = req.query?.externalId || req.body?.externalId || null;
    if (externalOverride) {
      const trimmed = String(externalOverride).trim();
      if (trimmed) externalId = trimmed;
    }

    if (!externalId) externalId = client;
    if (!displayName) displayName = externalId || client;

    if (isApple) {
      const iosTokenPayload = { client, campaign };
      if (externalId) iosTokenPayload.externalId = externalId;
      if (displayName) iosTokenPayload.name = displayName;
      if (tokenTier) iosTokenPayload.tier = tokenTier;
      const iosToken = jwt.sign(iosTokenPayload, SECRET, { expiresIn: "15m" });

      const tierQ = req.query?.tier || req.body?.tier;
      const nameQ = req.query?.name || req.body?.name;

      const qs = [];
      if (tierQ) qs.push(`tier=${encodeURIComponent(tierQ)}`);
      if (nameQ) qs.push(`name=${encodeURIComponent(nameQ)}`);

      const extra = qs.length ? `?${qs.join("&")}` : "";
      const appleUrl = `${baseUrl()}/api/wallet/ios/${iosToken}${extra}`;
      return res.redirect(302, appleUrl);
    }


    // Precedencia: tokenTier (si viene en el token) > query/body > DB
    const tier = tokenTier || tierFromAll({
      tipoCliente,
      campaign,
      queryTier: req.query?.tier,
      bodyTier:  req.body?.tier
    });

    console.log("[smart]", { client, campaign, tipoCliente, tier, classRef: classIdForTier(tier) });

    const googleSaveUrl = buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier });
    return res.redirect(302, googleSaveUrl);
  } catch (e) {
    const status  = e?.response?.status || 401;
    const details = e?.response?.data || e?.message || String(e);
    console.error("wallet/smart error:", details);
    return res.status(status).json({ message: "Token inválido/vencido", details });
  }
});

// ===================== Refresh endpoints (skeleton) =====================
// Estos endpoints dejan lista la estructura para refrescar tarjetas instaladas.
// Google: PATCH del objeto (requiere credenciales de Service Account y issuer).
// Apple: Push Notification a dispositivos registrados (requiere APNS y almacenamiento de device tokens).

function googleEnvReady() {
  return !!(process.env.GOOGLE_WALLET_ISSUER_ID && (process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY));
}

router.post("/wallet/refresh/google", async (req, res) => {
  try {
    const client   = String(req.body.client   || "").trim();
    const campaign = String(req.body.campaign || "").trim();
    const ext      = String(req.body.externalId || "").trim();
    const tierRaw  = req.body.tier;
    if (!client || !campaign) return res.status(400).json({ ok:false, error:"Faltan client/campaign" });

    // Resolver desde DB si falta externalId
    let externalId = ext || client;
    let tipoCliente = null; let displayName = client;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId = r.external_id || externalId;
        tipoCliente = r.tipoCliente || null;
        displayName = getDisplayName(r) || displayName;
      }
    } catch {}

    const tier = normalizeTier(tierRaw) || normalizeTier(tipoCliente, { loose:true }) || 'blue';

    // Si no hay credenciales, retornamos smart link para re-guardar manualmente (funciona hoy)
    if (!googleEnvReady()) {
      const saveUrl = buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier });
      return res.json({ ok:true, mode:'smart-link', saveUrl, message:'Credenciales de Google Wallet faltantes; usa saveUrl para re-guardar' });
    }

    // TODO: implementar PATCH del objeto con googleapis (requiere configuración completa)
    // Por ahora, devolvemos smart link además del stub
    const saveUrl = buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier });
    return res.json({ ok:true, mode:'stub', message:'PATCH no implementado aún; credenciales presentes', saveUrl });
  } catch (e) {
    console.error('refresh/google error:', e?.message || e);
    return res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
});

router.post("/wallet/refresh/apple", async (req, res) => {
  try {
    const client   = String(req.body.client   || "").trim();
    const campaign = String(req.body.campaign || "").trim();
    if (!client || !campaign) return res.status(400).json({ ok:false, error:'Faltan client/campaign' });

    // En esta base aún no almacenamos device tokens de Apple (registrations) para hacer APNS push.
    // Devolvemos el smart link (funciona en iOS):
    const tokenPayload = { client, campaign };
    if (req.body.externalId) tokenPayload.externalId = String(req.body.externalId);
    if (req.body.name) tokenPayload.name = String(req.body.name);
    const token = jwt.sign(tokenPayload, SECRET, { expiresIn:'2d' });
    const smartUrl = `${baseUrl()}/api/wallet/smart/${token}`;
    return res.json({ ok:true, mode:'smart-link', smartUrl, message:'APNS push no implementado; usa smartUrl para re-guardar' });
  } catch (e) {
    console.error('refresh/apple error:', e?.message || e);
    return res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
});

router.post("/wallet/refresh", async (req, res) => {
  try {
    const platform = String(req.body.platform || 'both').toLowerCase();
    const out = {};
    if (platform === 'google' || platform === 'both') {
      const r = await (await fetchLike(req, '/wallet/refresh/google')).json();
      out.google = r;
    }
    if (platform === 'apple' || platform === 'both') {
      const r = await (await fetchLike(req, '/wallet/refresh/apple')).json();
      out.apple = r;
    }
    return res.json({ ok:true, ...out });
  } catch (e) {
    console.error('refresh both error:', e?.message || e);
    return res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
});

// Helper interno: invoca nuestros endpoints con el mismo req (sin salir del proceso)
async function fetchLike(req, pathname) {
  const url = new URL(`http://internal${pathname}`);
  // Construir payload igual a req.body
  const body = JSON.stringify(req.body || {});
  const headers = { 'Content-Type':'application/json' };
  // Usamos node-fetch dinámico sin dependencia: implementamos minimal wrapper
  return await new Promise((resolve) => {
    const { Readable } = require('stream');
    const http = require('http');
    const options = { method:'POST', headers };
    const req2 = http.request(url, options, (res2) => {
      const chunks = [];
      res2.on('data', (c) => chunks.push(c));
      res2.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ json: async () => { try { return JSON.parse(text); } catch { return { ok:false, raw:text }; } } });
      });
    });
    if (body) Readable.from([body]).pipe(req2); else req2.end();
  });
}
// ===================== Smart link by member id (helper) =====================
router.get("/wallet/smart-link/member/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ ok:false, error:"missing id" });
    if (!pool || typeof pool.query !== 'function') return res.status(500).json({ ok:false, error:"db not available" });

    const [rows] = await pool.query(
      "SELECT id, external_id, nombre, apellido, codigoCliente, codigoCampana, tipoCliente FROM members WHERE id=? LIMIT 1",
      [id]
    );
    const m = rows && rows[0];
    if (!m) return res.status(404).json({ ok:false, error:"member not found" });

    const client   = String(m.codigoCliente || "").trim();
    const campaign = String(m.codigoCampana || "").trim();
    if (!client || !campaign) return res.status(400).json({ ok:false, error:"member missing client/campaign" });

    const displayName = getDisplayName(m) || client;
    const externalId  = String(m.external_id || client);
    const tierParam   = normalizeTier(m.tipoCliente, { loose: true }) || "blue";

    const payload = { client, campaign, tier: tierParam, externalId, name: displayName };
    const token   = jwt.sign(payload, SECRET, { expiresIn: "2d" });
    const smartUrl = `${baseUrl()}/api/wallet/smart/${token}`;

    return res.json({ ok:true, smartUrl, client, campaign, externalId, displayName, tier: tierParam });
  } catch (e) {
    console.error("smart-link/member error:", e?.message || e);
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});

// valida PUBLIC_BASE_URL al cargar
baseUrl();

// Exports: router para la app y funciones de ayuda para pruebas
module.exports = router;
module.exports.normalizeTier = normalizeTier;
module.exports.tierFromAll = tierFromAll;
module.exports.buildGoogleSaveUrl = buildGoogleSaveUrl;
