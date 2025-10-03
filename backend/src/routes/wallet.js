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

function getDisplayName(row) {
  if (!row) return null;
  const f = row.firstname ?? row.first_name ?? row.nombre ?? row.name ?? "";
  const l = row.lastname  ?? row.last_name  ?? row.apellido ?? "";
  const full = `${String(f||"").trim()} ${String(l||"").trim()}`.trim();
  return full || null;
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
  if (SKIP_DB) return null;

  // 1) camelCase
  let rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name, tipoCliente, codigoCliente, codigoCampana
       FROM members WHERE codigoCliente=? AND codigoCampana=? LIMIT 1`,
    [client, campaign]
  );
  if (rows?.[0]) return rows[0];

  // 2) sólo cliente (camelCase)
  rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name, tipoCliente, codigoCliente
       FROM members WHERE codigoCliente=? LIMIT 1`,
    [client]
  );
  if (rows?.[0]) return rows[0];

  // 3) snake_case
  rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name,
            tipo_cliente AS tipoCliente, codigo_cliente AS codigoCliente, codigo_campana AS codigoCampana
       FROM members WHERE codigo_cliente=? AND codigo_campana=? LIMIT 1`,
    [client, campaign]
  );
  if (rows?.[0]) return rows[0];

  // 4) sólo cliente (snake_case)
  rows = await tryQuery(
    `SELECT external_id, nombre, apellido, first_name, last_name,
            tipo_cliente AS tipoCliente, codigo_cliente AS codigoCliente
       FROM members WHERE codigo_cliente=? LIMIT 1`,
    [client]
  );
  return rows?.[0] || null;
}


// ===================== Google: construir Save URL =====================
function buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier }) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuer) throw new Error("Falta GOOGLE_WALLET_ISSUER_ID");
  if (!SA_EMAIL || !PRIVATE_KEY) throw new Error("Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY");

 const codeValue = String(externalId || client || "").trim();
if (!codeValue) throw new Error("No hay código para el miembro.");

  /*const rawTier  = String(tier || "");
  const gold     = /(gold|golden|dorado|oro|15)/i.test(rawTier);
  const tierNorm = gold ? "gold" : "blue";*/
   // Normalizar el tier aquí de forma permisiva (acepta "Gold 15%", "gold", etc.)
  const tierNorm = normalizeTier(tier, { loose: true }) || "blue";
  const gold = tierNorm === "gold";
  console.log("[buildGoogleSaveUrl] tier input:", tier, "=> tierNorm:", tierNorm, "gold:", gold);

  const tierLabel = gold ? "GOLD 15%" : "BLUE 5%";   // <- ¡vuelve!
  const verTag   = process.env.WALLET_OBJECT_REV || "2";

  const heroUri  = getHeroUrl();
  const origin   = baseUrl();

  // ID nuevo para forzar refresco en el teléfono
  const objectId = `${issuer}.${sanitize(
    `${codeValue}-${(campaign || "").toLowerCase()}-${tierNorm}-r${verTag}`
  )}`;

  // Clase correcta por tier (intenta helper, luego fallbacks desde env)
  let classRef = classIdForTier(tierNorm);
  // Fallbacks por si helpers/tier devuelve una clase inesperada o vacía
  const envGold = process.env.GW_CLASS_ID_GOLD || null;
  const envBlue = process.env.GW_CLASS_ID_BLUE || null;
  if (!classRef || (tierNorm === "gold" && /blue/i.test(String(classRef)))) {
    classRef = envGold || classRef;
  }
  if (!classRef || (tierNorm === "blue" && /gold/i.test(String(classRef)))) {
    classRef = envBlue || classRef;
  }
  console.log("[GW] class pick:", { objectId, tierNorm, classRef, envGold, envBlue });

  // Objeto con color forzado por tier
  const loyaltyObject = {
    id: objectId,
    classId: classRef,
    state: "ACTIVE",
    hexBackgroundColor: gold ? "#DAA520" : "#2350C6",

    accountId:   codeValue,
    accountName: displayName || codeValue,

    infoModuleData: {
      labelValueRows: [
        { columns: [{ label: "Nombre", value: displayName || codeValue }] },
        { columns: [{ label: "Nivel",  value: tierLabel }] },   // <- ya no rompe
        { columns: [{ label: "Código", value: codeValue }] }
      ],
      showLastUpdateTime: false
    },

    imageModulesData: [{ id: "alcazaren_hero", mainImage: { sourceUri: { uri: heroUri } } }],
    textModulesData:  [{ header: "Información", body: getInfoText(tierNorm) }],
    linksModuleData:  { uris: [{ uri: `${origin}/public/terminos`, description: "Términos y condiciones" }] },
    barcode: { type: "CODE_128", value: codeValue, alternateText: externalId },
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
    const { client, campaign } = jwt.verify(req.params.token, SECRET);

    // Datos del miembro
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
   if (req.query?.name) {
  displayName = String(req.query.name).trim();
}

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
    const serial = `${sanitize(client)}-${sanitize(campaign)}-${tier}`;

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
          message: String(externalId || "").normalize("NFKD").replace(/[^\x00-\x7F]/g, ""),
          messageEncoding: "iso-8859-1",
          altText: externalId, // se ve debajo
        }],

        // Campos visibles
        storeCard: {
          headerFields:    [{ key: "tier", label: "Nivel", value: tierLabel }],
          primaryFields:   [{ key: "name", label: "Nombre", value: displayName }],
          secondaryFields: [{ key: "code", label: "Código", value: externalId }],
          auxiliaryFields: []
        }
      }
    );

    // Texto al dorso
    const infoTxt = getInfoText(tier);
    if (infoTxt) pass.backFields = [{ key:"info", label:"Información", value: infoTxt }];

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
    const client   = String(req.query.client   || "");
    const campaign = String(req.query.campaign || "");
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
if (req.query?.name || req.body?.name) {
  displayName = String(req.query.name || req.body.name).trim();
}

console.log("[resolve] using:", { client, campaign, externalId, displayName, tipoCliente });
 
    // iOS → .pkpass
    if (forced === "apple" || isiOS) {
      const iosToken  = jwt.sign({ client, campaign }, SECRET, { expiresIn: "15m" });
      const extraTier = req.query.tier ? `?tier=${encodeURIComponent(req.query.tier)}` : "";
      const appleUrl  = `${baseUrl()}/api/wallet/ios/${iosToken}${extraTier}`;
      return res.redirect(302, appleUrl);
    }

    // Android/Google → Save URL
    const tier = tierFromAll({
  tipoCliente,
  campaign,
  queryTier: req.query?.tier,
  bodyTier:  req.body?.tier
});

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
    const { client, campaign } = jwt.verify(req.params.token, SECRET);

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
    const client   = String(req.body.client   || "");
    const campaign = String(req.body.campaign || "");
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

    // Smart link (pasamos nombre para iOS; externalId ya viaja por DB o cae a client)
    const token     = jwt.sign({ client, campaign }, SECRET, { expiresIn: "2d" });
    const nameParam = displayName ? `&name=${encodeURIComponent(displayName)}` : "";
    const smartUrl  = `${baseUrl()}/api/wallet/smart/${token}?tier=${encodeURIComponent(tierParam)}${nameParam}`;

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
    const { client, campaign } = jwt.verify(req.params.token, SECRET);
    const ua = String(req.get("user-agent") || "").toLowerCase();
    const isApple = /iphone|ipad|ipod|macintosh/.test(ua);

    // Enriquecer
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

    if (isApple) {
  const iosToken = jwt.sign({ client, campaign }, SECRET, { expiresIn: "15m" });

  const tierQ = req.query?.tier || req.body?.tier;
  const nameQ = req.query?.name || req.body?.name;

  const qs = [];
  if (tierQ) qs.push(`tier=${encodeURIComponent(tierQ)}`);
  if (nameQ) qs.push(`name=${encodeURIComponent(nameQ)}`);

  const extra = qs.length ? `?${qs.join("&")}` : "";
  const appleUrl = `${baseUrl()}/api/wallet/ios/${iosToken}${extra}`;
  return res.redirect(302, appleUrl);
}


    const tier = tierFromAll({
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

// valida PUBLIC_BASE_URL al cargar
baseUrl();

module.exports = router;
