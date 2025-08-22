// backend/routes/wallet.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db"); // ajusta si tu db está en otro sitio
const { GoogleAuth } = require("google-auth-library");

const fs = require("fs");
const sanitize = (s) => String(s).replace(/[^\w.-]/g, "_");

const SA_EMAIL  = process.env.GOOGLE_SA_EMAIL;                  // wallet-svc@...iam.gserviceaccount.com
const KEY_PATH  = process.env.GOOGLE_WALLET_KEY_PATH || "./keys/wallet-sa.json";

let PRIVATE_KEY = null;
try {
  PRIVATE_KEY = JSON.parse(fs.readFileSync(KEY_PATH, "utf8")).private_key;
} catch (e) {
  console.error("❌ No pude leer la private_key de", KEY_PATH, e.message);
}

const router = express.Router();
const SECRET = process.env.WALLET_TOKEN_SECRET || "changeme";

/** Normaliza a apple/google/unknown para la tabla */
function platformForTelemetry(req) {
  const p = pickPlatform(req); // 'ios' | 'google'
  if (p === "ios") return "apple";
  if (p === "google") return "google";
  return "unknown";
}


/** Detecta plataforma a partir del user-agent o de ?platform=ios|google */
function pickPlatform(req) {
  const q = String(req.query.platform || "").toLowerCase();
  if (q === "ios" || q === "apple") return "ios";
  if (q === "google" || q === "android") return "google";
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  return /iphone|ipad|ipod|ios/.test(ua) ? "ios" : "google";
}

/**
 * GET /wallet/resolve?client=L0003&campaign=C3214
 * - Busca al miembro
 * - Firma token corto
 * - Redirige a /wallet/ios/:token o /wallet/google/:token
 */
router.get("/wallet/resolve", async (req, res) => {
  const client = String(req.query.client || "").trim();
  const campaign = String(req.query.campaign || "").trim();
  if (!client || !campaign) {
    return res.status(400).json({ message: "client & campaign requeridos" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM members WHERE codigoCliente = ? AND codigoCampana = ? LIMIT 1`,
      [client, campaign]
    );

    const member = Array.isArray(rows) ? rows[0] : null;
    if (!member) return res.status(404).json({ message: "Miembro no encontrado" });

    const token = jwt.sign(
      {
        sub: String(member.id ?? member.memberId ?? member.codigoCliente ?? ""),
        client,
        campaign,
      },
      SECRET,
      { expiresIn: "15m" }
    );

    const platformUX = pickPlatform(req);             // 'ios' | 'google' (para decidir a dónde ir)
    const platformDB = platformForTelemetry(req);     // 'apple' | 'google' | 'unknown' (para guardar)
    const base = `${req.protocol}://${req.get("host")}`;
    const dest = platformUX === "ios"
      ? `${base}/api/wallet/ios/${token}`
      : `${base}/api/wallet/google/${token}`;

    // 👇👇👇  REGISTRO DEL ESCANEO (ANTES DE REDIRIGIR)  👇👇👇
    const sourceQ = String(req.query.source || "qr").toLowerCase(); // 'qr' | 'barcode' | 'link'
    const source = sourceQ === "barcode" ? "barcode" : sourceQ === "link" ? "link" : "qr";

    try {
      await pool.query(
        `INSERT INTO telemetry_events
           (member_id, pass_id, platform, source, event_type, user_agent, ip_address)
         VALUES (?, ?, ?, ?, 'scan', ?, ?)`,
        [
          member.id ?? null,          // member_id (si no tienes id, deja null)
          null,                       // pass_id (si no tienes aún, déjalo null)
          platformDB,                 // 'apple' | 'google' | 'unknown'
          source,                     // 'qr' | 'barcode' | 'link'
          req.headers["user-agent"] || null,
          req.headers["x-forwarded-for"] || req.ip || null,
        ]
      );
    } catch (e) {
      // No bloquees la experiencia si falla la telemetría
      console.error("telemetry scan insert error:", e.message || e);
    }
    // ☝️☝️☝️  FIN REGISTRO SCAN  ☝️☝️☝️

    return res.redirect(302, dest);
  } catch (e) {
    console.error("resolve error:", e);
    return res.status(500).json({ message: "Error interno" });
  }
});


/** Placeholder iOS (.pkpass más adelante) */
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

/** Pantalla completa para el código de barras (mejor lectura en POS) */
router.get("/wallet/barcode/full", (req, res) => {
  const value = String(req.query.value || "");
  if (!value) return res.status(400).send("missing value");
  const BASE = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const img = `${BASE}/api/barcode/${encodeURIComponent(value)}.png`;
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

router.get("/wallet/google/:token", async (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, SECRET);
    const { client, campaign } = payload;

    const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
    const klass  = process.env.GOOGLE_WALLET_CLASS_ID;
    if (!issuer || !klass) {
      return res.status(500).json({ message: "Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_CLASS_ID" });
    }
    if (!SA_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ message: "Faltan GOOGLE_SA_EMAIL o GOOGLE_WALLET_KEY_PATH/private_key" });
    }

    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;
    const classRef = `${issuer}.${klass}`;

    const codeValue = `PK|${client}|${campaign}`;
    const BASE = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const barcodeImgUrl  = `${BASE}/api/barcode/${encodeURIComponent(codeValue)}.png`;
    const barcodeFullUrl = `${BASE}/api/wallet/barcode/full?value=${encodeURIComponent(codeValue)}`;
    const codesUrl       = `${BASE}/api/wallet/codes?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}`;

    const loyaltyObject = {
      id: objectId,
      classId: classRef,
      state: "ACTIVE",
      accountId: client,
      accountName: client,
      barcode: { type: "QR_CODE", value: codeValue, alternateText: codeValue },
      imageModulesData: [
        {
          id: "barcode_img",
          mainImage: {
            sourceUri: { uri: barcodeImgUrl },
            contentDescription: { defaultValue: { language: "es", value: "Código de barras" } }
          }
        }
      ],
      linksModuleData: {
        uris: [
          { id: "codes_ui", description: "Mostrar mi código", uri: codesUrl },
          { id: "barcode_full", description: "Código de barras (pantalla completa)", uri: barcodeFullUrl }
        ]
      }
    };

    // Firma Save-to-Google
    const saveToken = jwt.sign(
      {
        iss: SA_EMAIL,
        aud: "google",
        typ: "savetoandroidpay",
        payload: { loyaltyObjects: [loyaltyObject] }
      },
      PRIVATE_KEY,
      { algorithm: "RS256" }
    );

    const saveUrl = `https://pay.google.com/gp/v/save/${saveToken}`;

    // Solo para depurar: ?raw=1 devuelve datos en lugar de redirigir
    if (req.query.raw === "1") {
      return res.json({ platform: "google", saveUrl, objectId, loyaltyObject });
    }

    return res.redirect(302, saveUrl);
  } catch (e) {
    console.error("wallet/google error:", e?.response?.data || e);
    return res.status(401).json({ message: "Token inválido o vencido" });
  }
});



// Lee un loyaltyObject directamente con el cliente de Google (sin armar Authorization a mano)
router.get("/wallet/debug/object", async (req, res) => {
  try {
    const client   = String(req.query.client || "");
    const campaign = String(req.query.campaign || "");
    if (!client || !campaign) {
      return res.status(400).json({ message: "client & campaign requeridos" });
    }

    const issuer   = process.env.GOOGLE_WALLET_ISSUER_ID;
    const objectId = `${issuer}.${`${client}-${campaign}`.replace(/[^\w.-]/g, "_")}`;

    const { GoogleAuth } = require("google-auth-library");
    const auth    = new GoogleAuth({
      keyFile: process.env.GOOGLE_WALLET_KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
    const gclient = await auth.getClient();

    // ¡Ojo! Usamos gclient.request; él agrega OAuth por ti
    const r = await gclient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      method: "GET",
    });

    return res.status(200).json(r.data);
  } catch (e) {
    // Si es 404 devolvemos ese status; si no, 500
    const status = e?.response?.status || 500;
    const data   = e?.response?.data || String(e);
    return res.status(status).json(data);
  }
});


// Crea el loyaltyObject si no existe (helper)
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

    const codeValue = `PK|${client}|${campaign}`;
    const BASE = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
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
          { id: "codes_ui",    description: "Mostrar mi código", uri: codesUrl },
          { id: "barcode_full", description: "Código de barras (pantalla completa)", uri: barcodeFullUrl },
        ],
      },
    };

    const auth    = new GoogleAuth({
      keyFile: process.env.GOOGLE_WALLET_KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
    const gclient = await auth.getClient();

    // Intentar crear
    const created = await gclient.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject",
      method: "POST",
      data: loyaltyObject,
      headers: { "Content-Type": "application/json" },
    }).catch(async (e) => {
      if (e?.response?.status === 409) {
        // Ya existe: lo leo y devuelvo
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


// PATCH para agregar/actualizar solo imageModulesData
router.get("/wallet/patch-image", async (req, res) => {
  try {
    const client = String(req.query.client || "");
    const campaign = String(req.query.campaign || "");
    if (!client || !campaign) {
      return res.status(400).json({ message: "client & campaign requeridos" });
    }

    const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;

    const codeValue = `PK|${client}|${campaign}`;
    const BASE = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const barcodeImgUrl = `${BASE}/api/barcode/${encodeURIComponent(codeValue)}.png`;

    const auth = new GoogleAuth({
      keyFile: process.env.GOOGLE_WALLET_KEY_PATH, // ej: ./keys/wallet-sa.json
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
    const gclient = await auth.getClient();

    const url =
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/` +
      encodeURIComponent(objectId) +
      `?updateMask=imageModulesData` +
      (req.query.notify ? `&notifyUsers=true` : "");

    const patchBody = {
      imageModulesData: [
        {
          id: "barcode_img",
          mainImage: {
            sourceUri: { uri: barcodeImgUrl },
            contentDescription: {
              defaultValue: { language: "es", value: "Código de barras" },
            },
          },
        },
      ],
    };

    //  Usa el cliente autenticado — él añade Authorization por ti
    const r = await gclient.request({
      url,
      method: "PATCH",
      data: patchBody,
      headers: { "Content-Type": "application/json" },
    });

    return res.json({ ok: true, objectId, barcodeImgUrl, google: r.data });
  } catch (e) {
    console.error("patch-image error:", e?.response?.data || e);
    return res
      .status(e?.response?.status || 500)
      .json({ ok: false, message: "patch error", details: e?.response?.data || String(e) });
  }
});

// PATCH: añade/actualiza el botón "Mostrar código de barras"
// PATCH: añade/actualiza el botón "Mostrar mi código" (UI unificada)
router.get("/wallet/patch-links", async (req, res) => {
  try {
    const client   = String(req.query.client || "");
    const campaign = String(req.query.campaign || "");
    if (!client || !campaign)
      return res.status(400).json({ message: "client & campaign requeridos" });

    const issuer   = process.env.GOOGLE_WALLET_ISSUER_ID;
    const objectId = `${issuer}.${sanitize(`${client}-${campaign}`)}`;

    const BASE     = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const codesUrl = `${BASE}/api/wallet/codes?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}`;

    const auth    = new GoogleAuth({ keyFile: process.env.GOOGLE_WALLET_KEY_PATH, scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"] });
    const gclient = await auth.getClient();

    // Leer objeto para conservar otros enlaces
    const get = await gclient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      method: "GET",
    });

    const currentUris = Array.isArray(get.data?.linksModuleData?.uris) ? get.data.linksModuleData.uris : [];
    const uris = currentUris.filter(u => u.id !== "codes_ui");   // limpia el anterior si existía
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


// UI unificada: QR + Barras en una sola pantalla
router.get("/wallet/codes", (req, res) => {
  // Acepta ?value=PK|...  o  ?client=...&campaign=...
  const client   = String(req.query.client || "");
  const campaign = String(req.query.campaign || "");
  const value    = String(req.query.value || (client && campaign ? `PK|${client}|${campaign}` : ""));

  if (!value) return res.status(400).send("missing value or client/campaign");

  const BASE = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const barcodeImg = `${BASE}/api/barcode/${encodeURIComponent(value)}.png`;

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
    // Generar QR en cliente (mismo valor)
    const value = ${JSON.stringify(value)};
    const qr = new QRCode(document.getElementById('qr'), {
      text: value, width: 760, height: 760, correctLevel: QRCode.CorrectLevel.M
    });

    // Tabs
    const elQr  = document.getElementById('qr');
    const elBar = document.getElementById('bar');
    const tabQr  = document.getElementById('tabQr');
    const tabBar = document.getElementById('tabBar');

    function show(which){
      if(which === 'qr'){ elQr.classList.add('show'); elBar.classList.remove('show'); tabQr.classList.add('active'); tabBar.classList.remove('active'); }
      else { elBar.classList.add('show'); elQr.classList.remove('show'); tabBar.classList.add('active'); tabQr.classList.remove('active'); }
      // solicitar fullscreen tras primera interacción
      document.body.addEventListener('click', goFS, {once:true});
      document.body.addEventListener('touchstart', goFS, {once:true});
    }
    tabQr.onclick = () => show('qr');
    tabBar.onclick = () => show('bar');

    // Fullscreen
    const btnFS = document.getElementById('btnFS');
    const goFS = () => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(()=>{});
    btnFS.onclick = goFS;

    // Arranca mostrando QR (puedes cambiar a 'bar')
    show('bar'); // si prefieres abrir en barras, deja 'bar'
  </script>`);
});

module.exports = router;
