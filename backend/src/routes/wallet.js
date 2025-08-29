// backend/src/routes/wallet.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { GoogleAuth } = require("google-auth-library");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// -------- Utils --------
const sanitize = (s) => String(s).replace(/[^\w.-]/g, "_");
function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

// -------- ENV --------
const SA_EMAIL = process.env.GOOGLE_SA_EMAIL; // wallet-svc@...iam.gserviceaccount.com
const SECRET   = process.env.WALLET_TOKEN_SECRET || "changeme";
const SKIP_DB  = process.env.SKIP_DB === "true";

// SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// -------- Carga de PRIVATE_KEY: contenido o archivo --------
const DEFAULT_KEY_PATH = "./keys/wallet-sa.json";
const KEY_PATH = process.env.GOOGLE_WALLET_KEY_PATH || DEFAULT_KEY_PATH;

let PRIVATE_KEY = null;

// 1) contenido directo (recomendado en Render)
if (process.env.GOOGLE_WALLET_PRIVATE_KEY) {
  try {
    const raw = process.env.GOOGLE_WALLET_PRIVATE_KEY.trim();
    if (raw.includes("BEGIN PRIVATE KEY")) {
      PRIVATE_KEY = raw; // PEM directo
    } else {
      const json = JSON.parse(raw);
      PRIVATE_KEY = json.private_key;
    }
  } catch (e) {
    console.error("❌ GOOGLE_WALLET_PRIVATE_KEY inválida:", e.message);
  }
}

// 2) archivo
if (!PRIVATE_KEY) {
  try {
    let resolvedPath = KEY_PATH;
    if (!fs.existsSync(resolvedPath) && fs.existsSync(DEFAULT_KEY_PATH)) {
      resolvedPath = DEFAULT_KEY_PATH;
    }
    const fileRaw = fs.readFileSync(resolvedPath, "utf8");
    const parsed  = JSON.parse(fileRaw);
    PRIVATE_KEY   = parsed.private_key;
  } catch (e) {
    console.error("❌ No pude leer la private_key:", e.message);
  }
}
if (!PRIVATE_KEY) {
  console.warn("⚠️  PRIVATE_KEY vacío. /wallet/google fallará sin clave.");
}

const router = express.Router();

/* -------------------- Detección de plataforma -------------------- */
function pickPlatform(req) {
  const q = String(req.query.platform || "").toLowerCase();
  if (q === "ios" || q === "apple") return "ios";
  if (q === "google" || q === "android") return "google";
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  if (/iphone|ipad|ipod|ios/.test(ua)) return "ios";
  if (/android/.test(ua)) return "google";
  return "google"; // por defecto
}
function platformForTelemetry(req) {
  const p = pickPlatform(req);
  if (p === "ios") return "apple";
  if (p === "google") return "google";
  return "unknown";
}

// --- helpers de datos de miembro ---
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

// --- elegir la CLASS de Google Wallet según la campaña/tier ---
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

/* =================================================================
   GET /wallet/resolve?client=L0003&campaign=C3214[&platform=ios|google][&source=qr|barcode|link][&dry=1]
   - Busca al miembro (members.codigoCliente & members.codigoCampana)
   - Firma token (sin expiración) con { client, campaign, extId, name }
   - Redirige a /wallet/ios/:token o /wallet/google/:token
   - Registra evento 'scan' en telemetry_events
   ================================================================ */
router.get("/wallet/resolve", async (req, res) => {
  const client = String(req.query.client || "").trim();
  const campaign = String(req.query.campaign || "").trim();
  if (!client || !campaign) return res.status(400).json({ message: "client & campaign requeridos" });

  try {
    let member = null;

    if (!SKIP_DB) {
      const [rows] = await pool.query(
        `SELECT * FROM members WHERE codigoCliente = ? AND \`codigoCampana\` = ? LIMIT 1`,
        [client, campaign]
      );
      member = Array.isArray(rows) ? rows[0] : null;
      if (!member) return res.status(404).json({ message: "Miembro no encontrado" });
    } else {
      member = { id: null }; // modo sin DB
    }

    // datos que queremos empujar al token
    const extId = getExternalId(member);
    const displayName = getDisplayName(member) || null;

    // Token sin expiración (si quieres expirar, agrega { expiresIn: "15m" })
    const token = jwt.sign(
      { sub: String(member?.id ?? client), client, campaign, extId, name: displayName },
      SECRET
    );

    const platformUX = pickPlatform(req);
    const platformDB = platformForTelemetry(req);
    const dest = platformUX === "ios"
      ? `${baseUrl(req)}/api/wallet/ios/${token}`
      : `${baseUrl(req)}/api/wallet/google/${token}`;

    // Telemetría (solo si hay DB)
    if (!SKIP_DB) {
      const source = /^(barcode|link)$/i.test(req.query.source) ? req.query.source.toLowerCase() : "qr";
      try {
        await pool.query(
          `INSERT INTO telemetry_events (member_id, pass_id, platform, source, event_type, user_agent, ip_address)
           VALUES (?, ?, ?, ?, 'scan', ?, ?)`,
          [member?.id ?? null, null, platformDB, source, req.headers["user-agent"] || null, req.headers["x-forwarded-for"] || req.ip || null]
        );
      } catch (e) {
        console.error("telemetry scan insert error:", e.message || e);
      }
    }

    if (req.query.dry === "1") return res.json({ next: dest, platformUX, platformDB, memberId: member?.id || null, extId, name: displayName });
    return res.redirect(302, dest);
  } catch (e) {
    console.error("resolve error:", e);
    return res.status(500).json({ message: "Error interno" });
  }
});

/* -------------------- Placeholder iOS (.pkpass más adelante) -------------------- */
router.get("/wallet/ios/:token", (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, SECRET);
    return res.json({
      platform: "ios",
      message: "OK iOS. Próximo paso: generar y devolver un .pkpass firmado.",
      payload,
    });
  } catch {
    return res.status(401).json({ message: "Token inválido o vencido" });
  }
});

/* -------------------- Pantalla completa para código de barras -------------------- */
router.get("/wallet/barcode/full", (req, res) => {
  const value = String(req.query.value || "");
  if (!value) return res.status(400).send("missing value");
  const img = `${baseUrl(req)}/api/barcode/${encodeURIComponent(value)}.png`;
  res.send(`
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{margin:0;background:#fff;height:100vh;display:flex;align-items:center;justify-content:center}
      img{width:95vw;max-width:800px;height:auto;image-rendering:crisp-edges}
      .txt{position:fixed;bottom:10px;width:100%;text-align:center;font:14px system-ui}
    </style>
    <img src="${img}" alt="Código de barras"/>
    <div class="txt">${value}</div>
  `);
});

// =================================================================
// GET /wallet/google/:token  -> genera Save URL firmado y redirige
// =================================================================
router.get("/wallet/google/:token", async (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, SECRET);
    const { client, campaign } = payload;

    const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
    const klass  = pickClassIdByCampaign(campaign);
    if (!issuer || !klass) {
      return res.status(500).json({ message: "Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_CLASS_ID" });
    }
    if (!SA_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ message: "Faltan GOOGLE_SA_EMAIL o PRIVATE_KEY" });
    }

    // --- leer datos del miembro para obtener external_id y nombre ---
    let externalId = client;   // fallback
    let displayName = client;  // fallback
    try {
      if (!SKIP_DB) {
        const [rows] = await pool.query(
          `SELECT external_id, nombre, apellido, first_name, last_name
             FROM members
            WHERE codigoCliente=? AND \`codigoCampana\`=? LIMIT 1`,
          [client, campaign]
        );
        if (Array.isArray(rows) && rows[0]) {
          const r = rows[0];
          externalId = r.external_id || client;
          const fn = r.nombre || r.first_name || "";
          const ln = r.apellido || r.last_name || "";
          const full = `${String(fn||"").trim()} ${String(ln||"").trim()}`.trim();
          displayName = full || client;
        }
      }
    } catch {}

    // --- el objeto para Google Wallet ---
    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;
    const classRef = `${issuer}.${klass}`;

    // AHORA el código y el texto visible son el external_id
    const codeValue = externalId;

    const BASE = baseUrl(req);
    const barcodeImgUrl  = `${BASE}/api/barcode/${encodeURIComponent(codeValue)}.png`;
    const barcodeFullUrl = `${BASE}/api/wallet/barcode/full?value=${encodeURIComponent(codeValue)}`;
    const codesUrl       = `${BASE}/api/wallet/codes?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}`;

    const loyaltyObject = {
      id: objectId,
      classId: classRef,
      state: "ACTIVE",

      // Lo que ves en el panel derecho de Wallet
      accountId:   externalId,   // ID de miembro
      accountName: displayName,  // Nombre de miembro

      // El QR y el texto debajo del QR usan el external_id
      barcode: { type: "QR_CODE", value: codeValue, alternateText: externalId },

      // Imagen con el código de barras generado por tu backend (opcional)
      imageModulesData: [
        {
          id: "barcode_img",
          mainImage: {
            sourceUri: { uri: barcodeImgUrl },
            contentDescription: { defaultValue: { language: "es", value: "Código de barras" } }
          }
        }
      ],

      // Texto adicional (opcional)
      textModulesData: displayName ? [
        { header: "Nombre", body: displayName }
      ] : [],

      linksModuleData: {
        uris: [
          { id: "codes_ui",    description: "Mostrar mi código",                    uri: codesUrl },
          { id: "barcode_full", description: "Código de barras (pantalla completa)", uri: barcodeFullUrl }
        ]
      }
    };

    const saveToken = jwt.sign(
      { iss: SA_EMAIL, aud: "google", typ: "savetoandroidpay", payload: { loyaltyObjects: [loyaltyObject] } },
      PRIVATE_KEY,
      { algorithm: "RS256" }
    );

    const saveUrl = `https://pay.google.com/gp/v/save/${saveToken}`;
    if (req.query.raw === "1") {
      return res.json({ platform: "google", saveUrl, objectId, loyaltyObject });
    }
    return res.redirect(302, saveUrl);
  } catch (e) {
    const status  = e?.response?.status || 401;
    const details = e?.response?.data || e?.message || String(e);
    console.error("wallet/google error:", details);
    return res.status(status).json({ message: "Token inválido/vencido o error en Google Wallet", details });
  }
});


/* -------------------- Leer/crear objeto directamente (debug/dev) -------------------- */
router.get("/wallet/debug/object", async (req, res) => {
  try {
    const client   = String(req.query.client || "");
    const campaign = String(req.query.campaign || "");
    if (!client || !campaign) {
      return res.status(400).json({ message: "client & campaign requeridos" });
    }
    const issuer   = process.env.GOOGLE_WALLET_ISSUER_ID;
    const objectId = `${issuer}.${`${client}-${campaign}`.replace(/[^\w.-]/g, "_")}`;

    const auth    = new GoogleAuth({
      keyFile: process.env.GOOGLE_WALLET_KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
    const gclient = await auth.getClient();
    const r = await gclient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      method: "GET",
    });
    return res.status(200).json(r.data);
  } catch (e) {
    const status = e?.response?.status || 500;
    const data   = e?.response?.data || String(e);
    return res.status(status).json(data);
  }
});

/* -------------------- Crear (o devolver si existe) loyaltyObject (dev) -------------------- */
router.get("/wallet/dev-insert", async (req, res) => {
  try {
    const client   = String(req.query.client || "");
    const campaign = String(req.query.campaign || "");
    if (!client || !campaign) {
      return res.status(400).json({ message: "client & campaign requeridos" });
    }

    const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
    const klass  = process.env.GOOGLE_WALLET_CLASS_ID;
    if (!issuer || !klass) {
      return res.status(500).json({ message: "Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_CLASS_ID" });
    }

    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;
    const classId  = `${issuer}.${klass}`;

    const codeValue = `PK|${client}|${campaign}`; // dev: ejemplo rápido
    const BASE = baseUrl(req);
    const barcodeImgUrl  = `${BASE}/api/barcode/${encodeURIComponent(codeValue)}.png`;
    const barcodeFullUrl = `${BASE}/api/wallet/barcode/full?value=${encodeURIComponent(codeValue)}`;
    const codesUrl       = `${BASE}/api/wallet/codes?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}`;

    const loyaltyObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      accountId: client,
      accountName: client,
      barcode: { type: "QR_CODE", value: codeValue, alternateText: codeValue },
      imageModulesData: [
        {
          id: "barcode_img",
          mainImage: {
            sourceUri: { uri: barcodeImgUrl },
            contentDescription: { defaultValue: { language: "es", value: "Código de barras" } },
          },
        },
      ],
      linksModuleData: {
        uris: [
          { id: "codes_ui", description: "Mostrar mi código", uri: codesUrl },
          { id: "barcode_full", description: "Código de barras (pantalla completa)", uri: barcodeFullUrl },
        ],
      },
    };

    const auth    = new GoogleAuth({
      keyFile: process.env.GOOGLE_WALLET_KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
    const gclient = await auth.getClient();

    const created = await gclient.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject",
      method: "POST",
      data: loyaltyObject,
      headers: { "Content-Type": "application/json" },
    }).catch(async (e) => {
      if (e?.response?.status === 409) {
        const r = await gclient.request({
          url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
          method: "GET",
        });
        return { data: r.data, existed: true };
      }
      throw e;
    });

    res.json({ ok: true, objectId, existed: created.existed === true, google: created.data });
  } catch (e) {
    res.status(e?.response?.status || 500).json(e?.response?.data || String(e));
  }
});

/* -------------------- PATCH: actualizar solo imageModulesData -------------------- */
router.get("/wallet/patch-image", async (req, res) => {
  try {
    const client   = String(req.query.client || "");
    const the_campaign = String(req.query.campaign || "");
    const campaign = the_campaign;
    if (!client || !campaign) return res.status(400).json({ message: "client & campaign requeridos" });

    const issuer   = process.env.GOOGLE_WALLET_ISSUER_ID;
    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;

    const codeValue = `PK|${client}|${campaign}`;
    const barcodeImgUrl = `${baseUrl(req)}/api/barcode/${encodeURIComponent(codeValue)}.png`;

    const auth    = new GoogleAuth({ keyFile: process.env.GOOGLE_WALLET_KEY_PATH, scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"] });
    const gclient = await auth.getClient();

    const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}?updateMask=imageModulesData${req.query.notify ? "&notifyUsers=true" : ""}`;

    const r = await gclient.request({
      url, method: "PATCH",
      data: {
        imageModulesData: [
          {
            id: "barcode_img",
            mainImage: {
              sourceUri: { uri: barcodeImgUrl },
              contentDescription: { defaultValue: { language: "es", value: "Código de barras" } },
            },
          },
        ],
      },
      headers: { "Content-Type": "application/json" },
    });

    return res.json({ ok: true, objectId, barcodeImgUrl, google: r.data });
  } catch (e) {
    console.error("patch-image error:", e?.response?.data || e);
    return res.status(e?.response?.status || 500).json({ ok: false, message: "patch error", details: e?.response?.data || String(e) });
  }
});

/* -------------------- PATCH: actualizar linksModuleData (añade 'Mostrar mi código') -------------------- */
router.get("/wallet/patch-links", async (req, res) => {
  try {
    const client   = String(req.query.client || "");
    const campaign = String(req.query.campaign || "");
    if (!client || !campaign) return res.status(400).json({ message: "client & campaign requeridos" });

    const issuer   = process.env.GOOGLE_WALLET_ISSUER_ID;
    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;
    const codesUrl = `${baseUrl(req)}/api/wallet/codes?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}`;

    const auth    = new GoogleAuth({ keyFile: process.env.GOOGLE_WALLET_KEY_PATH, scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"] });
    const gclient = await auth.getClient();

    const get = await gclient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      method: "GET",
    });

    const currentUris = Array.isArray(get.data?.linksModuleData?.uris) ? get.data.linksModuleData.uris : [];
    const uris = currentUris.filter(u => u.id !== "codes_ui");
    uris.push({ id: "codes_ui", description: "Mostrar mi código", uri: codesUrl });

    const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}?updateMask=linksModuleData${req.query.notify ? "&notifyUsers=true" : ""}`;

    const r = await gclient.request({
      url, method: "PATCH",
      headers: { "Content-Type": "application/json" },
      data: { linksModuleData: { uris } },
    });

    res.json({ ok: true, objectId, codesUrl, google: r.data });
  } catch (e) {
    res.status(e?.response?.status || 500).json({ ok: false, error: e?.response?.data || String(e) });
  }
});

// -------------------- UI unificada: QR + Barras --------------------
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
  <meta name="theme-color" content="#ffffff">
  <title>Tu código</title>
  <style>
    :root { --pad:16px; --maxW:1100px; }
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#111;font:16px system-ui, -apple-system, Segoe UI, Roboto}
    .wrap{min-height:100svh;display:flex;flex-direction:column;align-items:center;gap:12px;padding:var(--pad)}
    .bar{width:100%;max-width:var(--maxW);display:flex;gap:8px;align-items:center;justify-content:space-between}
    .left{display:flex;gap:8px;align-items:center}
    .tab, .btn{border:1px solid #ddd;background:#f8f8f8;padding:10px 14px;border-radius:10px;cursor:pointer}
    .tab.active{background:#111;color:#fff;border-color:#111}
    .canvas{width:100%;max-width:var(--maxW);display:flex;align-items:center;justify-content:center}
    #qr, #bar{display:none}
    #qr.show, #bar.show{display:block}
    #qr > canvas, #qr > img{width:min(92vw,760px);height:auto}
    #bar{width:min(96vw,1200px);height:auto;image-rendering:crisp-edges;image-rendering:pixelated}
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


/* -------------------- Telemetría: registrar instalación -------------------- */
router.post("/telemetry/install", async (req, res) => {
  try {
    const b = req.body || {};
    const memberId = b.member_id ?? null;
    const passId   = b.pass_id ?? null;

    let p = String(b.platform || "").toLowerCase();
    let platform =
      p === "ios" || p === "apple" ? "apple" :
      p === "google" || p === "android" ? "google" :
      platformForTelemetry(req);

    const sourceRaw = String(b.source || req.query.source || "link").toLowerCase();
    const source =
      sourceRaw === "qr" ? "qr" :
      sourceRaw === "barcode" ? "barcode" : "link";

    await pool.query(
      `INSERT INTO telemetry_events
         (member_id, pass_id, platform, source, event_type, user_agent, ip_address)
       VALUES (?, ?, ?, ?, 'install', ?, ?)`,
      [
        memberId,
        passId,
        platform,
        source,
        req.headers["user-agent"] || null,
        req.headers["x-forwarded-for"] || req.ip || null,
      ]
    );

    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("telemetry install error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* -------------------- Enviar pase por email (manual) -------------------- */
router.post("/wallet/send", async (req, res) => {
  try {
    const { client, campaign, email, platform = "google" } = req.body || {};
    if (!client || !campaign || !email) {
      return res.status(400).json({ ok:false, error:"client, campaign y email son requeridos" });
    }

    // Intenta traer nombre/apellido para saludar, pero si SKIP_DB=true simplemente continúa
    let memberId = null;
    let displayName = "";

    if (!SKIP_DB) {
      try {
        const [rows] = await pool.query(
          `SELECT id, nombre, apellido, first_name, last_name
           FROM members
           WHERE codigoCliente = ? AND \`codigoCampana\` = ?
           LIMIT 1`,
          [client, campaign]
        );
        if (rows.length) {
          memberId = rows[0].id;
          displayName = getDisplayName(rows[0]) || "";
        }
      } catch (e) {
        // Si la DB falla, seguimos sin nombre
        console.warn("wallet/send: DB lookup skipped:", e?.message || e);
      }
    }

    // Token SIN expiración
    const token = jwt.sign({ id: memberId, client, campaign }, SECRET);

    const appleUrl  = `${baseUrl(req)}/api/wallet/ios/${token}`;
    const googleUrl = `${baseUrl(req)}/api/wallet/google/${token}`;

    // Email con light/dark y sin texto de expiración
    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"PassForge" <no-reply@passforge.local>',
      to: email,
      subject: "Tu pase digital",
      html: `
        <meta name="color-scheme" content="light dark">
        <style>
          :root{ color-scheme: light dark; }
          body{ margin:0; background:#111827; color:#f9fafb; font:16px system-ui,-apple-system,Segoe UI,Roboto }
          .wrap{ max-width:720px; margin:0 auto; padding:24px }
          .card{ background:#0f2b40; padding:28px; border-radius:16px; line-height:1.45 }
          .btn{ display:inline-block; padding:12px 18px; border-radius:8px; text-decoration:none; font-weight:600; margin-right:8px }
          .btn-ios{ border:1px solid #111; color:#111; background:#fff }
          .btn-gw{ background:#1a73e8; color:#fff }
          @media (prefers-color-scheme: light){
            body{ background:#f3f4f6; color:#111827 }
            .card{ background:#ffffff }
            .btn-ios{ border-color:#111; color:#111; background:#fff }
          }
        </style>
        <div class="wrap">
          <div class="card">
            <h2 style="margin-top:0">Su Tarjeta de Lealtad</h2>
            ${displayName ? `<p>Estimado/a <strong>${displayName}</strong>,</p>` : ""}
            <p>Guárdela en su billetera móvil:</p>
            <p>
              <a class="btn btn-ios" href="${appleUrl}">Add to Apple Wallet</a>
              <a class="btn btn-gw" href="${googleUrl}">Add to Google Wallet</a>
            </p>
          </div>
        </div>
      `,
    });

    // Telemetría: solo si tenemos DB y memberId
    if (!SKIP_DB && memberId) {
      try {
        await pool.query(
          `INSERT INTO telemetry_events
           (member_id, pass_id, platform, source, event_type, user_agent, ip_address)
           VALUES (?, ?, ?, ?, 'install', ?, ?)`,
          [
            memberId,
            null,
            platform === "apple" ? "apple" : "google",
            "link",
            "mailer",
            null,
          ]
        );
      } catch (e) {
        console.warn("wallet/send: telemetry insert skipped:", e?.message || e);
      }
    }

    return res.json({ ok:true });
  } catch (e) {
    console.error("wallet/send error:", e);
    return res.status(500).json({ ok:false, error: (e?.message || String(e)) });
  }
});


module.exports = router;
