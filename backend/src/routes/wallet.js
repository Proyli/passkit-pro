// backend/src/routes/wallet.js
// backend/src/routes/wallet.js (imports)
const { classIdForTier } = require("../helpers/tier"); 
const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const fs = require("fs");
const path = require("path");

// ✅ usa el export correcto
const { PKPass } = require("passkit-generator");

// ----------------- Utils -----------------
const sanitize = (s) => String(s).replace(/[^\w.-]/g, "_");
function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
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
// ------ Helper: construir Save URL (Google Wallet) ------
// ------ Helper: construir Save URL (Google Wallet) ------
function buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier }) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuer) throw new Error("Falta GOOGLE_WALLET_ISSUER_ID");
  if (!SA_EMAIL || !PRIVATE_KEY) throw new Error("Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY");

  const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;

  // classId por TIER (gold/blue). classIdForTier devuelve issuer.classId-suffix
  const classRef = classIdForTier((tier || "blue").toLowerCase());

  const codeValue = externalId || client;

  const loyaltyObject = {
    id: objectId,
    classId: classRef,
    state: "ACTIVE",
    accountId:  codeValue,
    accountName: displayName || codeValue,

    // Bloque "Name" como en el mock
    infoModuleData: {
      labelValueRows: [
        { columns: [{ label: "Name", value: displayName || codeValue }] }
      ]
    },

    // CODE 128 como en el mock
    barcode: { type: "CODE_128", value: codeValue, alternateText: codeValue }
  };

  const saveToken = jwt.sign(
    { iss: SA_EMAIL, aud: "google", typ: "savetowallet", payload: { loyaltyObjects: [loyaltyObject] } },
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


// -------------------- Placeholder iOS (.pkpass más adelante) --------------------
router.get("/wallet/ios/:token", async (req, res) => {
  try {
    const { client, campaign } = jwt.verify(req.params.token, SECRET);

    // (Opcional) enriquecer con DB
    let externalId = client;
    let displayName = client;
    try {
      const r = await findMemberFlexible(client, campaign);
      if (r) {
        externalId  = r.external_id || client;
        const fn = r.nombre || r.first_name || "";
        const ln = r.apellido || r.last_name || "";
        displayName = `${String(fn||"").trim()} ${String(ln||"").trim()}`.trim() || client;
      }
    } catch {}

    // ✅ rutas por defecto pensadas para Render
    const CERTS = process.env.CERT_DIR  || "/etc/secrets";
    const MODEL = process.env.MODEL_DIR || path.resolve(process.cwd(), "passes/alcazaren.pass");

    // Iconos obligatorios (icon.png, icon@2x.png dentro de MODEL)
    const icon1x = path.join(MODEL, "icon.png");
    const icon2x = path.join(MODEL, "icon@2x.png");
    if (!fs.existsSync(icon1x) || !fs.existsSync(icon2x)) {
      return res.status(500).type("text").send("Faltan icon.png e icon@2x.png en MODEL_DIR");
    }

    // Cargar plantilla + certificados desde SECRET FILES
    const pass = await PKPass.from({
      model: MODEL,
      certificates: {
        wwdr: path.join(CERTS, "wwdr.pem"),
        signerCert: path.join(CERTS, "signerCert.pem"),
        signerKey: path.join(CERTS, "signerKey.pem"),
        signerKeyPassphrase: process.env.APPLE_CERT_PASSWORD || undefined,
      },
    });

    // Metadatos del pase
    pass.set("formatVersion", 1);
    pass.set("passTypeIdentifier", process.env.APPLE_PASS_TYPE_ID);
    pass.set("teamIdentifier", process.env.APPLE_TEAM_ID);
    pass.set("organizationName", process.env.APPLE_ORG_NAME || "Distribuidora Alcazaren");
    const serial = `${sanitize(client)}-${sanitize(campaign)}`;
    pass.set("serialNumber", serial);
    pass.set("description", "Tarjeta de Lealtad Alcazaren");

    // Colores / campos
    pass.set("foregroundColor", "rgb(255,255,255)");
    pass.set("labelColor", "rgb(255,255,255)");
    pass.set("backgroundColor", "#8B173C");

    pass.primaryFields.add({ key: "name", label: "Nombre", value: displayName });
    pass.secondaryFields.add({ key: "code", label: "Código", value: externalId });

    // Código de barras
    pass.setBarcodes({
      format: "PKBarcodeFormatCode128",
      message: externalId,
      messageEncoding: "iso-8859-1",
      altText: externalId,
    });

    const buffer = await pass.asBuffer();
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `inline; filename="${sanitize(serial)}.pkpass"`);
    return res.send(buffer);
  } catch (e) {
    console.error("ios pkpass error:", e);
    return res.status(500).send(e?.message || "pkpass error");
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
      const appleUrl = `${baseUrl(req)}/api/wallet/ios/${iosToken}`;
      return res.redirect(302, appleUrl);
    }

    // ✅ Android/Google (o forzado google) -> Save to Wallet
    const tier = (tipoCliente || req.query.tier || "blue").toLowerCase();
    const saveUrl = buildGoogleSaveUrl({ client, campaign, externalId, displayName, tier });
    return res.redirect(302, saveUrl);
  } catch (e) {
    console.error("wallet/resolve error:", e?.message || e);
    return res.status(500).send("resolve failed");
  }
});



// =================================================================
// (Compat) GET /wallet/google/:token -> genera Save URL y redirige
// =================================================================
// En wallet.js
router.get("/wallet/google/:token", async (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, SECRET);
    const { client, campaign } = payload;

    const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
    if (!issuer) return res.status(500).json({ message: "Falta GOOGLE_WALLET_ISSUER_ID" });
    if (!SA_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ message: "Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY" });
    }

    // ===== lee datos del miembro: external_id, nombre Y tipoCliente (tier) =====
    let externalId = client;
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


    // ===== elegir la CLASS: 1) por tier, 2) por campaign, 3) default =====
    const klassFromTier = pickClassIdByTier(tipoCliente);
    const klass = klassFromTier || pickClassIdByCampaign(campaign) || process.env.GOOGLE_WALLET_CLASS_ID;
    if (!klass) return res.status(500).json({ message: "Falta GOOGLE_WALLET_CLASS_ID(_GOLD/_BLUE)" });

    const classRef = `${issuer}.${klass}`;

    // === resto de tu código igual (con externalId/displayName) ===
    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;
    const codeValue = externalId;

    const BASE = baseUrl(req);
    const barcodeImgUrl  = `${BASE}/api/barcode/${encodeURIComponent(codeValue)}.png`;
    const barcodeFullUrl = `${BASE}/api/wallet/barcode/full?value=${encodeURIComponent(codeValue)}`;
    const codesUrl       = `${BASE}/api/wallet/codes?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}`;

    const loyaltyObject = {
      id: objectId,
      classId: classRef,
      state: "ACTIVE",
      accountId: externalId,
      accountName: displayName,
      barcode: { type: "QR_CODE", value: codeValue, alternateText: externalId },
      imageModulesData: [
        {
          id: "barcode_img",
          mainImage: {
            sourceUri: { uri: barcodeImgUrl },
            contentDescription: { defaultValue: { language: "es", value: "Código de barras" } }
          }
        }
      ],
      textModulesData: displayName ? [{ header: "Nombre", body: displayName }] : [],
      linksModuleData: {
        uris: [
          { id: "codes_ui",    description: "Mostrar mi código",                    uri: codesUrl },
          { id: "barcode_full", description: "Código de barras (pantalla completa)", uri: barcodeFullUrl }
        ]
      }
    };

    const saveToken = jwt.sign(
      { iss: SA_EMAIL, aud: "google", typ: "savetowallet", payload: { loyaltyObjects: [loyaltyObject] } },
      PRIVATE_KEY,
      { algorithm: "RS256" }
    );

    const saveUrl = `https://pay.google.com/gp/v/save/${saveToken}`;
    if (req.query.raw === "1") return res.json({ platform: "google", saveUrl, objectId, loyaltyObject });
    return res.redirect(302, saveUrl);
  } catch (e) {
    const status  = e?.response?.status || 401;
    const details = e?.response?.data || e?.message || String(e);
    console.error("wallet/google error:", details);
    return res.status(status).json({ message: "Token inválido/vencido o error en Google Wallet", details });
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
      const appleUrl = `${baseUrl(req)}/api/wallet/ios/${iosToken}`;
      return res.redirect(302, appleUrl);
    }

    // Android/Google Wallet → usa tier (preferencia: DB, luego query/body, luego "blue")
    const tier = (tipoCliente || req.body?.tier || req.query?.tier || "blue").toLowerCase();

    const googleSaveUrl = buildGoogleSaveUrl({
      client,
      campaign,
      externalId,
      displayName,
      tier
    });

    return res.redirect(302, googleSaveUrl);
  } catch (e) {
    const status  = e?.response?.status || 401;
    const details = e?.response?.data || e?.message || String(e);
    console.error("wallet/smart error:", details);
    return res.status(status).json({ message: "Token inválido/vencido", details });
  }
});


module.exports = router;
