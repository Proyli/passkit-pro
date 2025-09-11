// backend/routes/applePass.js
const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const { PKPass } = require("passkit-generator");

const router = express.Router();

/** Resuelve siempre contra la carpeta backend, sin “backend/” duplicado */
const BASE = path.resolve(__dirname, "..");
const CERT_DIR  = process.env.CERT_DIR  || path.join(BASE, "certs");
const MODEL_DIR = process.env.MODEL_DIR || path.join(BASE, "passes", "alcazaren.pass");

console.log("[applePass] CERT_DIR:", CERT_DIR);
console.log("[applePass] MODEL_DIR:", MODEL_DIR);

/** (opcional pero útil) Validaciones al arrancar */
if (!fs.existsSync(CERT_DIR))                     throw new Error(`Certs dir no existe: ${CERT_DIR}`);
if (!fs.existsSync(path.join(CERT_DIR,"AppleWWDR.pem")))  throw new Error("Falta AppleWWDR.pem");
if (!fs.existsSync(path.join(CERT_DIR,"pass_cert.pem")))  throw new Error("Falta pass_cert.pem");
if (!fs.existsSync(path.join(CERT_DIR,"pass_private.key"))) throw new Error("Falta pass_private.key");
if (!fs.existsSync(MODEL_DIR))                    throw new Error(`Modelo PassKit no encontrado: ${MODEL_DIR}`);
if (!fs.existsSync(path.join(MODEL_DIR,"pass.json")))      throw new Error("Falta pass.json en el modelo");

const wwdr       = fs.readFileSync(path.join(CERT_DIR, "AppleWWDR.pem"));
const signerCert = fs.readFileSync(path.join(CERT_DIR, "pass_cert.pem"));
const signerKey  = fs.readFileSync(path.join(CERT_DIR, "pass_private.key"));
const signerKeyPassphrase = process.env.PASS_KEY_PASSPHRASE || undefined;

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
