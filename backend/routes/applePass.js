// backend/routes/applePass.js
const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const { PKPass } = require("passkit-generator");

const router = express.Router();

// Base local
const BASE = path.resolve(__dirname, "..");

// Usa env si existe; si no, pruebo /etc/secrets; y si tampoco, backend/certs
const CERT_DIR  = process.env.CERT_DIR  || "/etc/secrets" || path.join(BASE, "certs");
const MODEL_DIR = process.env.MODEL_DIR || path.join(BASE, "passes", "alcazaren.pass");

console.log("CERT_DIR:", CERT_DIR);
console.log("MODEL_DIR:", MODEL_DIR);

// helper para elegir el primer archivo que exista entre varias opciones
function pickFile(dir, ...names) {
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Acepta ambas convenciones de nombres
const wwdrPath       = pickFile(CERT_DIR, "AppleWWDR.pem", "wwdr.pem");
const signerCertPath = pickFile(CERT_DIR, "pass_cert.pem", "signerCert.pem");
const signerKeyPath  = pickFile(CERT_DIR, "pass_private.key", "signerKey.pem");

if (!wwdrPath)       throw new Error("Falta AppleWWDR.pem/wwdr.pem");
if (!signerCertPath) throw new Error("Falta pass_cert.pem/signerCert.pem");
if (!signerKeyPath)  throw new Error("Falta pass_private.key/signerKey.pem");
if (!fs.existsSync(MODEL_DIR)) throw new Error(`Modelo PassKit no encontrado: ${MODEL_DIR}`);

const wwdr       = fs.readFileSync(wwdrPath);
const signerCert = fs.readFileSync(signerCertPath);
const signerKey  = fs.readFileSync(signerKeyPath);
const signerKeyPassphrase = process.env.PASS_KEY_PASSPHRASE || undefined;

// … el resto del archivo (ruta /apple/pass/:serial) queda igual …


router.get("/apple/pass/:serial", async (req, res) => {
  try {
    const displayName  = (req.query.displayName || req.query.name || "Cliente").toString();
    const membershipId = (req.query.membershipId || req.query.mid || req.params.serial).toString();

    const pass = await PKPass.from(
      {
        model: MODEL_DIR,
        certificates: { wwdr, signerCert, signerKey, signerKeyPassphrase },
      },
      {
        serialNumber: membershipId,
        barcodes: [
          {
            format: "PKBarcodeFormatCode128",
            message: `PK|${membershipId}|ALCAZAREN`,
            messageEncoding: "iso-8859-1",
            altText: membershipId,
          },
        ],
        storeCard: {
          primaryFields: [{ key: "title", label: "Lealtad Alcazarén", value: "Lealtad Alcazarén" }],
          secondaryFields: [{ key: "name", label: "Name", value: displayName }],
          auxiliaryFields: [{
            key: "info",
            label: "Information",
            value: "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo. Aplican restricciones.",
          }],
          backFields: [{ key: "terms", label: "Términos", value: "Aplican restricciones." }],
        },
      }
    );

    res
      .status(200)
      .type("application/vnd.apple.pkpass")
      .set("Content-Disposition", `attachment; filename="alcazaren-${membershipId}.pkpass"`)
      .send(pass.getAsBuffer());
  } catch (e) {
    console.error("apple/pass error:", e);
    res.status(500).json({ error: e.message || "No se pudo generar el pase" });
  }
});

module.exports = router;
