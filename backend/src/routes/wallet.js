const { classIdForTier } = require("../helpers/tier"); 
const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const fs = require("fs");
const path = require("path");
const { sendMailSmart } = require("../mailer");
const { renderWalletEmail, mergeSettings } = require("../../services/renderEmail");
const crypto = require("crypto");


// Carga robusta de passkit-generator (soporta Pass, PKPass o default)
let _passlib;
try {
  _passlib = require("passkit-generator");
} catch (e) {
  console.error("❌ No se pudo cargar 'passkit-generator':", e?.message || e);
  _passlib = {};
}
const Pass =
  _passlib.Pass ||           // algunas versiones exportan Pass
  _passlib.PKPass ||         // otras exportan PKPass
  _passlib.default || null;  // y otras exportan default

if (!Pass || typeof Pass.from !== "function") {
  console.error("❌ 'passkit-generator' no expone Pass.from/PKPass.from. Revisa versión instalada.");
}

// ----------------- Paths certificados y modelo -----------------
const CERTS = process.env.CERT_DIR
  ? process.env.CERT_DIR                 // Render: /etc/secrets
  : path.resolve(__dirname, "../../certs"); // Local: backend/certs

const MODEL = process.env.MODEL_DIR
  ? path.resolve(process.env.MODEL_DIR)      // si lo mandas por env
  : path.resolve(__dirname, "../../passes/alcazaren.pass"); // backend/passes/alcazaren.pass

console.log("[wallet] CERTS =", CERTS);
console.log("[wallet] MODEL =", MODEL);
["wwdr.pem","signerCert.pem","signerKey.pem"].forEach(f=>{
  console.log(`[wallet] exists ${f}?`, fs.existsSync(path.join(CERTS,f)));
});
console.log("[wallet] model exists?", fs.existsSync(MODEL));


// ----------------- Utils -----------------
const sanitize = (s) => String(s).replace(/[^\w.-]/g, "_");
// 🔒 Antibalas: SIEMPRE usa .env (sin barra final). No dependas de req.
function baseUrl() {
  const env = String(process.env.PUBLIC_BASE_URL || "").trim();
  return env.replace(/\/+$/, ""); // quita barra final por si acaso
}


// --- Helpers de banner y textos para Google Wallet ---
function getHeroUrl() {
  const envUrl = (process.env.GW_HERO || "").trim();
  if (envUrl) return envUrl;
  return `${baseUrl()}/public/hero-alcazaren.jpeg`;
}


function getInfoText(tier) {
  const t = String(tier || "").toLowerCase();
  if (t.includes("gold") || t.includes("15")) {
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

function normalizeTier(s) {
  const t = String(s || "").toLowerCase();
  if (t.includes("gold") || t.includes("15")) return "gold";
  if (t.includes("blue") || t.includes("5"))  return "blue";
  return "";
}

// DB manda; si DB no trae, usa query/body; si nada, blue
function tierFromSources({ tipoCliente, queryTier, bodyTier }) {
  return (
    normalizeTier(tipoCliente) ||
    normalizeTier(queryTier)    ||
    normalizeTier(bodyTier)     ||
    "blue"
  );
}


// ----------------- ENV -----------------
const SA_EMAIL = process.env.GOOGLE_SA_EMAIL; // wallet-svc@...iam.gserviceaccount.com
const SECRET   = process.env.WALLET_TOKEN_SECRET || "changeme";
const SKIP_DB  = process.env.SKIP_DB === "true";

console.log("[wallet] SECRET prefix:", String(SECRET || "none").slice(0, 10));


// ----------------- PRIVATE KEY (var o archivo) -----------------
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

// ----------------- Router -----------------
const router = express.Router();

// Salud (útil para pings)
router.get("/healthz", (_req, res) => res.status(200).send("ok"));

// -------- helpers de datos de miembro --------
function getDisplayName(row) {
  if (!row) return null;
  const f = row.firstname ?? row.first_name ?? row.nombre ?? row.name ?? "";
  const l = row.lastname ?? row.last_name ?? row.apellido ?? "";
  const full = `${String(f||"").trim()} ${String(l||"").trim()}`.trim();
  return full || null;
}
function getExternalId(row){
  return row?.external_id ?? row?.externalId ?? row?.external ?? null;
}

function pickClassIdByTier(tier) {
  const t = String(tier || "").toLowerCase();
  if (!t) return null;
  if (t.includes("gold") || t.includes("15")) {
    return process.env.GOOGLE_WALLET_CLASS_ID_GOLD || process.env.GOOGLE_WALLET_CLASS_ID;
  }
  if (t.includes("blue") || t.includes("5")) {
    return process.env.GOOGLE_WALLET_CLASS_ID_BLUE || process.env.GOOGLE_WALLET_CLASS_ID;
  }
  return null; // otras variantes aún no mapeadas
}


// -------- elegir CLASS según campaña/tier --------
function pickClassIdByCampaign(campaign) {
  const c = String(campaign || "").toLowerCase();
  if (c.includes("gold") || c.includes("15")) {
    return process.env.GOOGLE_WALLET_CLASS_ID_GOLD || process.env.GOOGLE_WALLET_CLASS_ID;
  }
  if (c.includes("blue") || c.includes("5")) {
    return process.env.GOOGLE_WALLET_CLASS_ID_BLUE || process.env.GOOGLE_WALLET_CLASS_ID;
  }
  return process.env.GOOGLE_WALLET_CLASS_ID; // fallback
}


// ------ Helper: construir Save URL (Google Wallet) ------
function buildGoogleSaveUrl(req, { client, campaign, externalId, displayName, tier }) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuer) throw new Error("Falta GOOGLE_WALLET_ISSUER_ID");
  if (!SA_EMAIL || !PRIVATE_KEY) throw new Error("Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY");

  // ⚠️ Requerimos externalId: si no hay, no creamos pase (así nunca cae a 'client')
  const codeValue = String(externalId || "").trim();
  if (!codeValue) throw new Error("No hay externalId para el miembro.");

  const tierNorm = String(tier || "blue").toLowerCase();

  // 👉 Construir displayName a partir de client.nombre + client.apellido si no vino
const displayNameFinal =
  [client?.nombre, client?.apellido]
    .filter(Boolean)
    .join(" ")
    .trim() || displayName || codeValue; // fallback
  // ID técnico del objeto (no visible para el usuario)
  const objectId = `${issuer}.${sanitize(`${codeValue}-${(campaign||"").toLowerCase()}-${tierNorm}`)}`;

  // Clase según tier (blue/gold)
  const classRef = classIdForTier(tierNorm);

  // Imagen hero (abajo). Usa GW_HERO o /public/hero-alcazaren.jpeg
  const heroUri = getHeroUrl();  // en vez de getHeroUrl(req)
const origin  = baseUrl();     // ya que baseUrl() tampoco recibe req


  // justo antes del loyaltyObject:
const tierLabel = tierNorm === "gold" ? "GOLD 15%" : "BLUE 5%";

const loyaltyObject = {
  id: objectId,
  classId: classRef,
  state: "ACTIVE",

  // 👉 fuerza el color del pase por tier
  hexBackgroundColor: tierNorm === "gold" ? "#D4AF37" : "#2350C6",

  // lo que lee el escáner y el texto bajo el código
  accountId:   codeValue,
  accountName: displayNameFinal,

  // BLOQUES VISIBLES
  infoModuleData: {
    labelValueRows: [
      { columns: [{ label: "Nombre", value: displayNameFinal }] },
      { columns: [{ label: "Nivel",  value: tierLabel }] },
      { columns: [{ label: "Código", value: codeValue }] }
    ],
    showLastUpdateTime: false
  },

  imageModulesData: [
    { id: "alcazaren_hero", mainImage: { sourceUri: { uri: heroUri } } }
  ],

  textModulesData: [
    { header: "Información", body: getInfoText(tierNorm) }
  ],

  linksModuleData: {
    uris: [
      { uri: `${origin}/public/terminos`, description: "Términos y condiciones" }
    ]
  },

  barcode: { type: "CODE_128", value: codeValue, alternateText: externalId },
};

// JWT con origins (necesario para el flujo web/Gmail)
const saveToken = jwt.sign(
  {
    iss: SA_EMAIL,
    aud: "google",
    typ: "savetowallet",
    payload: {
      loyaltyObjects: [loyaltyObject],
      origins: [origin],
    },
  },
  PRIVATE_KEY,
  { algorithm: "RS256" }
);

return `https://pay.google.com/gp/v/save/${saveToken}`;
}



function makeSmartLink(req, googleSaveUrl, appleUrl) {
  const token = jwt.sign({ g: googleSaveUrl, a: appleUrl }, SECRET, { expiresIn: "7d" });
  return `${baseUrl(req)}/api/wallet/smart/${token}`;
}

async function findMemberFlexible(client, campaign) {
  if (SKIP_DB) return null;

  // 1) intento estricto (cliente + campaña)
  let [rows] = await pool.query(
    `SELECT external_id, nombre, apellido, first_name, last_name, tipoCliente, codigoCliente, codigoCampana
       FROM members
      WHERE codigoCliente=? AND \`codigoCampana\`=? LIMIT 1`,
    [client, campaign]
  );
  if (rows?.[0]) return rows[0];

  // 2) si campaña viene vacía o es igual al cliente → busca sólo por cliente
  [rows] = await pool.query(
    `SELECT external_id, nombre, apellido, first_name, last_name, tipoCliente, codigoCliente, codigoCampana
       FROM members
      WHERE codigoCliente=? LIMIT 1`,
    [client]
  );
  if (rows?.[0]) return rows[0];

  // 3) último recurso: por campaña (por si la escribieron igual al cliente)
  [rows] = await pool.query(
    `SELECT external_id, nombre, apellido, first_name, last_name, tipoCliente, codigoCliente, codigoCampana
       FROM members
      WHERE \`codigoCampana\`=? LIMIT 1`,
    [campaign]
  );
  return rows?.[0] || null;
}

// -------------------- iOS (.pkpass con passkit-generator v3) --------------------
router.get("/wallet/ios/:token", async (req, res) => {
  try {
    const { client, campaign } = jwt.verify(req.params.token, SECRET);

    // --- Datos del miembro (externalId, nombre y tier desde BD si aplica) ---
    let externalId  = client;
    let displayName = client;
    let tipoCliente = null; // "gold" | "blue"
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId  = r.external_id || client;
        const fn = r.nombre || r.first_name || "";
        const ln = r.apellido || r.last_name || "";
        displayName = `${String(fn||"").trim()} ${String(ln||"").trim()}`.trim() || client;
        tipoCliente = r.tipoCliente || null;
      }
    } catch {}

    // --- Modelo (chequeo mínimo de iconos) ---
    const icon1x = path.join(MODEL, "icon.png");
    const icon2x = path.join(MODEL, "icon@2x.png");
    if (!fs.existsSync(icon1x) || !fs.existsSync(icon2x)) {
      return res.status(500).type("text").send("Faltan icon.png e icon@2x.png en MODEL_DIR");
    }

    // --- Certificados ---
    const wwdr       = fs.readFileSync(path.join(CERTS, "wwdr.pem"));
    const signerCert = fs.readFileSync(path.join(CERTS, "signerCert.pem"));
    const signerKey  = fs.readFileSync(path.join(CERTS, "signerKey.pem"));

    // --- Tema por tier (puedes forzar con ?tier=gold|blue) ---
    const tier = String(tipoCliente || req.query.tier || "blue").toLowerCase();
    const theme = (tier.includes("gold") || tier.includes("15"))
      ? { bg: "#E88B20", fg: "rgb(255,255,255)", label: "rgb(255,255,255)" } // GOLD
      : { bg: "#1F4AB8", fg: "rgb(255,255,255)", label: "rgb(255,255,255)" }; // BLUE

    // --- Serial con tier para evitar caché si cambias de color ---
    const serial = `${sanitize(client)}-${sanitize(campaign)}-${tier}`;

    // --- Construcción del pass: campos dentro de storeCard (se ven en la hoja de agregar) ---
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

        webServiceURL: `${baseUrl()}/applews`,                           // 👈
    authenticationToken: process.env.APPLE_WS_TOKEN, 
        foregroundColor: theme.fg,
        labelColor:      theme.label,
        backgroundColor: theme.bg,

        // Código de barras
        barcodes: [{
          format: "PKBarcodeFormatCode128",
          message: String(externalId || "").normalize("NFKD").replace(/[^\x00-\x7F]/g, ""),
          messageEncoding: "iso-8859-1",
          altText: externalId,
        }],

        storeCard: {
          headerFields: [
            { key: "tier", label: "Nivel", value: tierLabel }
          ],
          primaryFields: [
            { key: "name", label: "Nombre", value: displayName }
          ],
          secondaryFields: [
            { key: "code", label: "Código", value: externalId }
          ],
          auxiliaryFields: []
        }
      }
    );

    // --- Texto largo al dorso (igual que Google) ---
    const infoTxt = getInfoText(tier);
    if (infoTxt) {
      pass.backFields = [{ key:"info", label:"Información", value: infoTxt }];
    }

    // --- Responder .pkpass ---
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

// ===============================================================
// NUEVO: GET /wallet/resolve
// Decide destino segun ?platform=apple|google y/o User-Agent
//  - Android / google -> redirige a https://pay.google.com/gp/v/save/<JWT>
//  - iOS / apple      -> (por ahora) página informativa (reemplaza por .pkpass cuando lo tengas)
// ===============================================================
router.get("/wallet/resolve", async (req, res) => {
  try {
    const client   = String(req.query.client   || "");
    const campaign = String(req.query.campaign || "");
    const forced   = String(req.query.platform || "").toLowerCase(); // apple | google | ""
    if (!client || !campaign) return res.status(400).send("missing client/campaign");

    const ua    = String(req.get("user-agent") || "");
    const isiOS = /iPhone|iPad|iPod/i.test(ua);

    // --- enriquecer con DB: external_id, nombre/apellido, tipoCliente ---
    let externalId  = client;
    let displayName = client;
    let tipoCliente = null;

    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId = r.external_id || client;
        const fn = r.nombre || r.first_name || "";
        const ln = r.apellido || r.last_name || "";
        displayName = `${String(fn||"").trim()} ${String(ln||"").trim()}`.trim() || client;
        tipoCliente = r.tipoCliente || null;
      }
    } catch {}

    // ✅ iOS (o forzado apple) -> redirige a /wallet/ios/:token (genera pkpass)
if (forced === "apple" || isiOS) {
  const iosToken = jwt.sign({ client, campaign }, SECRET, { expiresIn: "15m" });
  // reenviar tier si viene en la query
  const extraTier = req.query.tier ? `?tier=${encodeURIComponent(req.query.tier)}` : "";
  const appleUrl  = `${baseUrl(req)}/api/wallet/ios/${iosToken}${extraTier}`;
  return res.redirect(302, appleUrl);
}


    // ✅ Android/Google (o forzado google) -> Save to Wallet
    const tier = tierFromSources({
      tipoCliente,
      queryTier: req.query.tier,
      bodyTier:  req.body?.tier
    });

    // ⬇️ INSERTA AQUÍ
console.log(
  "[resolve] client=", client,
  "campaign=", campaign,
  "tipoCliente(DB)=", tipoCliente,
  "tierFinal=", tier,
  "classRef=", classIdForTier(tier)
);

    const saveUrl = buildGoogleSaveUrl(req, { client, campaign, externalId, displayName, tier });
    return res.redirect(302, saveUrl);

  } catch (e) {
    console.error("wallet/resolve error:", e?.message || e);
    return res.status(500).send("resolve failed");
  }
});



// =================================================================
// (Compat) GET /wallet/google/:token -> genera Save URL y redirige
// =================================================================
router.get("/wallet/google/:token", async (req, res) => {
  try {
    const { client, campaign } = jwt.verify(req.params.token, SECRET);

    if (!process.env.GOOGLE_WALLET_ISSUER_ID) {
      return res.status(500).json({ message: "Falta GOOGLE_WALLET_ISSUER_ID" });
    }
    if (!SA_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ message: "Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY" });
    }

    // enriquecer datos desde DB
    let externalId  = client;
    let displayName = client;
    let tipoCliente = null;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId  = r.external_id || client;
        const fn = r.nombre || r.first_name || "";
        const ln = r.apellido || r.last_name || "";
        displayName = `${String(fn||"").trim()} ${String(ln||"").trim()}`.trim() || client;
        tipoCliente = r.tipoCliente || null;
      }
    } catch {}

    const tier = tierFromSources({
  tipoCliente,
  queryTier: req.query.tier
});
const saveUrl = buildGoogleSaveUrl(req, { client, campaign, externalId, displayName, tier });
return res.redirect(302, saveUrl);

  } catch (e) {
    console.error("wallet/google error:", e?.message || e);
    return res.status(401).json({ message: "Token inválido/vencido o error en Google Wallet", details: e?.message });
  }
});

// -------------------- UI unificada: QR + Barras (opcional) --------------------
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

  const barcodeImg = `${baseUrl(req)}/api/barcode/${encodeURIComponent(value)}.png`;

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

// -------------------- Telemetría: instalar (opcional) --------------------
router.post("/telemetry/install", async (req, res) => {
  try {
    const b = req.body || {};
    const memberId = b.member_id ?? null;
    const passId   = b.pass_id ?? null;
    let p = String(b.platform || "").toLowerCase();
    let platform =
      p === "ios" || p === "apple" ? "apple" :
      p === "google" || p === "android" ? "google" : "unknown";
    const sourceRaw = String(b.source || req.query.source || "link").toLowerCase();
    const source =
      sourceRaw === "qr" ? "qr" :
      sourceRaw === "barcode" ? "barcode" : "link";
    if (!SKIP_DB) {
      await pool.query(
        `INSERT INTO telemetry_events
           (member_id, pass_id, platform, source, event_type, user_agent, ip_address)
         VALUES (?, ?, ?, ?, 'install', ?, ?)`,
        [memberId, passId, platform, source, req.headers["user-agent"] || null, req.headers["x-forwarded-for"] || req.ip || null]
      );
    }
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("telemetry install error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Smart link: detecta iOS/Android y redirige al destino correcto
// Smart link: detecta iOS/Android y redirige al destino correcto
router.get("/wallet/smart/:token", async (req, res) => {
  try {
    const { client, campaign } = jwt.verify(req.params.token, SECRET);
    const ua = String(req.get("user-agent") || "").toLowerCase();
    const isApple = /iphone|ipad|ipod|macintosh/.test(ua);

    // --- Enriquecer con DB: external_id, nombre/apellido, tipoCliente ---
    let externalId  = client;
    let displayName = client;
    let tipoCliente = null;

    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId = r.external_id || client;
        const fn = r.nombre || r.first_name || "";
        const ln = r.apellido || r.last_name || "";
        displayName = `${String(fn||"").trim()} ${String(ln||"").trim()}`.trim() || client;
        tipoCliente = r.tipoCliente || null; // "gold" / "blue"
      }
    } catch {}

    // iOS → endpoint de Apple (.pkpass)
    if (isApple) {
    const iosToken = jwt.sign({ client, campaign }, SECRET, { expiresIn: "15m" });
    const tier = req.query?.tier || req.body?.tier;
    const extraTier = tier ? `?tier=${encodeURIComponent(tier)}` : "";
    const appleUrl = `${baseUrl(req)}/api/wallet/ios/${iosToken}${extraTier}`;
    return res.redirect(302, appleUrl);
  }

    // Android/Google Wallet → usa tier (preferencia: DB, luego query/body, luego "blue")
    const tier = tierFromSources({
    tipoCliente,
    queryTier: req.query?.tier,
    bodyTier:  req.body?.tier
  });
  console.log(
  "[smart] client=", client,
  "campaign=", campaign,
  "tipoCliente(DB)=", tipoCliente,
  "tierFinal=", tier,
  "classRef=", classIdForTier(tier)
);


  const googleSaveUrl = buildGoogleSaveUrl(req, { client, campaign, externalId, displayName, tier });
  return res.redirect(302, googleSaveUrl);

  } catch (e) {
    const status  = e?.response?.status || 401;
    const details = e?.response?.data || e?.message || String(e);
    console.error("wallet/smart error:", details);
    return res.status(status).json({ message: "Token inválido/vencido", details });
  }
});

// valida PUBLIC_BASE_URL
baseUrl();

// POST /api/wallet/email  → envía el correo con el smart link
router.post("/wallet/email", async (req, res) => {
  try {
    const client   = String(req.body.client   || "");
    const campaign = String(req.body.campaign || "");
    const to       = String(req.body.to       || "");
    if (!client || !campaign || !to) {
      return res.status(400).json({ ok:false, message:"Falta client/campaign/to" });
    }

    // --- Buscar datos del miembro ---
    let externalId = null;
    let displayName = client;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId = r.external_id || null;
        const fn = r.nombre || r.first_name || "";
        const ln = r.apellido || r.last_name || "";
        displayName = `${String(fn||"").trim()} ${String(ln||"").trim()}`.trim() || client;
      }
    } catch {}

    if (!externalId) {
      return res.status(400).json({ ok:false, message:"No hay externalId para el miembro." });
    }

    // --- Smart link (redirige a iOS/Google) ---
    const token    = jwt.sign({ client, campaign }, SECRET, { expiresIn: "2d" });
    const smartUrl = `${baseUrl(req)}/api/wallet/smart/${token}`;

    // 👇 Log para verificar que apunta a tu dominio y no a render.com
console.log("[email] SMART_URL =>", smartUrl);
    // --- Render del correo (usa tu template) ---
    const settings = mergeSettings(); // overrides opcionales
    const html = renderWalletEmail(settings, {
      displayName,
      membershipId: externalId,
      smartUrl,
    });

    // Subject y messageId únicos → evita “Mostrar texto citado” en Gmail
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0,16);
    const subject   = `${settings.subject} • ${displayName || externalId} • ${stamp}`;
    const messageId = `<${crypto.randomBytes(9).toString("hex")}@alcazaren.com.gt>`;

    // --- Enviar (Outlook → fallback Gmail) ---
    await sendMailSmart({
      to,
      subject,
      html,
      text:
        `Su Tarjeta de Lealtad\n\n` +
        `Hola ${displayName || ""}, guarde su tarjeta en su billetera digital.\n\n` +
        `Añadir a mi Wallet: ${smartUrl}\n\n` +
        `Este es un correo automático. No responda a este mensaje.`,
      messageId,
      inReplyTo: undefined,
      references: undefined,
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
      },
    });

    return res.status(200).json({ ok:true, to, smartUrl });
  } catch (e) {
    console.error("send wallet email error:", e?.message || e);
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});


module.exports = router;
