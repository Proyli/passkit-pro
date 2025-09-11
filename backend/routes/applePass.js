// backend/routes/applePass.js
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { PKPass } = require("passkit-generator");

const router = express.Router();

/* ========== Certificados & Modelo ========== */
// Directorios candidatos (toma el primero que exista)
const BASE = path.resolve(__dirname, "..");
const CERT_DIRS = [
  process.env.CERT_DIR,           // p.ej. /etc/secrets (Render Secret Files)
  "/etc/secrets",
  path.join(BASE, "certs"),
].filter(Boolean);

const CERT_DIR = CERT_DIRS.find((d) => {
  try { return d && fs.existsSync(d); } catch { return false; }
}) || CERT_DIRS[CERT_DIRS.length - 1];

const MODEL_DIR =
  process.env.MODEL_DIR ||
  path.join(BASE, "passes", "alcazaren.pass");

// Nombres candidatos (acepta diferentes convenciones)
const WWDR_CANDIDATES = ["wwdr.pem", "AppleWWDR.pem", "WWDR.pem"];
const SIGNER_CERT_CANDIDATES = [
  process.env.SIGNER_CERT_FILE,
  "signerCert.pem",
  "pass_cert.pem",
  "certificate.pem",
  "cert.pem",
];
const SIGNER_KEY_CANDIDATES = [
  process.env.SIGNER_KEY_FILE,
  "signerKey.pem",
  "pass_private.key",
  "private.key",
  "key.pem",
];

// Utilidad: encuentra el primer archivo existente en CERT_DIR
function pickFile(candidates) {
  for (const name of candidates.filter(Boolean)) {
    const p = path.join(CERT_DIR, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const WWDR_PATH       = pickFile(WWDR_CANDIDATES);
const SIGNER_CERT_PATH = pickFile(SIGNER_CERT_CANDIDATES);
const SIGNER_KEY_PATH  = pickFile(SIGNER_KEY_CANDIDATES);

// Validaciones tempranas (lanzan error si falta algo crítico)
if (!WWDR_PATH)        throw new Error(`WWDR no encontrado en ${CERT_DIR}. Probé: ${WWDR_CANDIDATES.join(", ")}`);
if (!SIGNER_CERT_PATH) throw new Error(`Certificado de firma no encontrado en ${CERT_DIR}. Probé: ${SIGNER_CERT_CANDIDATES.join(", ")}`);
if (!SIGNER_KEY_PATH)  throw new Error(`Llave privada no encontrada en ${CERT_DIR}. Probé: ${SIGNER_KEY_CANDIDATES.join(", ")}`);
if (!fs.existsSync(MODEL_DIR)) throw new Error(`Modelo PassKit no encontrado: ${MODEL_DIR}`);

const wwdr       = fs.readFileSync(WWDR_PATH);
const signerCert = fs.readFileSync(SIGNER_CERT_PATH);
const signerKey  = fs.readFileSync(SIGNER_KEY_PATH);
const signerKeyPassphrase =
  process.env.SIGNER_KEY_PASSPHRASE ||
  process.env.PASS_KEY_PASSPHRASE   ||
  process.env.PASS_CERT_PASSWORD    ||
  undefined;

console.log("[applePass] CERT_DIR:", CERT_DIR);
console.log("[applePass] MODEL_DIR:", MODEL_DIR);
console.log("[applePass] WWDR:", path.basename(WWDR_PATH));
console.log("[applePass] signerCert:", path.basename(SIGNER_CERT_PATH));
console.log("[applePass] signerKey:", path.basename(SIGNER_KEY_PATH));

/* ========== Helper para generar el .pkpass ========== */
async function buildPkPass({ membershipId, displayName }) {
  const pass = await PKPass.from(
    {
      model: MODEL_DIR,
      certificates: { wwdr, signerCert, signerKey, signerKeyPassphrase },
    },
    {
      serialNumber: membershipId,

      // CODE128 (no QR)
      barcodes: [
        {
          format: "PKBarcodeFormatCode128",
          message: `PK|${membershipId}|ALCAZAREN`,
          messageEncoding: "iso-8859-1",
          altText: membershipId,
        },
      ],

      // Campos básicos (usa tu modelo .pass para imagen/colores)
      storeCard: {
        primaryFields: [
          { key: "title", label: "Lealtad Alcazarén", value: "Lealtad Alcazarén" },
        ],
        secondaryFields: [
          { key: "name", label: "Name", value: displayName || "Cliente" },
        ],
        auxiliaryFields: [
          {
            key: "info",
            label: "Information",
            value:
              "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo. Aplican restricciones.",
          },
        ],
        backFields: [
          { key: "terms", label: "Términos", value: "Aplican restricciones." },
        ],
      },
    }
  );

  return pass.getAsBuffer();
}

/* ========== Rutas ========== */
// Tu ruta original con :serial
router.get("/apple/pass/:serial", async (req, res) => {
  try {
    const displayName  = req.query.displayName || req.query.name || "Cliente";
    const membershipId = req.query.membershipId || req.query.mid || req.params.serial;

    const buf = await buildPkPass({ membershipId, displayName });

    res
      .status(200)
      .type("application/vnd.apple.pkpass")
      .set("Content-Disposition", 'attachment; filename="alcazaren.pkpass"')
      .send(buf);
  } catch (e) {
    console.error("apple/pass error:", e);
    res.status(500).json({ ok: false, error: "No se pudo generar el pase" });
  }
});

// Alias sin :serial, usando query params (por compatibilidad)
router.get("/apple/pkpass", async (req, res) => {
  try {
    const displayName  = req.query.displayName || req.query.name || "Cliente";
    const membershipId = req.query.membershipId || req.query.mid || req.query.serial || "MID-0001";

    const buf = await buildPkPass({ membershipId, displayName });

    res
      .status(200)
      .type("application/vnd.apple.pkpass")
      .set("Content-Disposition", 'attachment; filename="alcazaren.pkpass"')
      .send(buf);
  } catch (e) {
    console.error("apple/pkpass error:", e);
    res.status(500).json({ ok: false, error: "No se pudo generar el pase" });
  }
});

module.exports = router;
