// backend/routes/applePass.js
const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const { PKPass } = require("passkit-generator");

const router = express.Router();

// ⬇️ AQUÍ van tus líneas de certificados (justo debajo de los imports)
const CERT_DIR  = path.join(process.cwd(), "backend", "certs");
const MODEL_DIR = path.join(process.cwd(), "backend", "passes", "alcazaren.pass");

const wwdr       = fs.readFileSync(path.join(CERT_DIR, "AppleWWDR.pem"));
const signerCert = fs.readFileSync(path.join(CERT_DIR, "pass_cert.pem"));
const signerKey  = fs.readFileSync(path.join(CERT_DIR, "pass_private.key"));
const signerKeyPassphrase = process.env.PASS_KEY_PASSPHRASE || undefined;

// Ruta que devuelve el .pkpass
router.get("/apple/pass/:serial", async (req, res) => {
  try {
    const pass = await PKPass.from(
      {
        model: MODEL_DIR,
        certificates: { wwdr, signerCert, signerKey, signerKeyPassphrase },
      },
      {
        serialNumber: req.params.serial,
        barcodes: [{
          format: "PKBarcodeFormatCode128",
          message: `ALC-${req.params.serial}`,
          messageEncoding: "iso-8859-1",
        }],
      }
    );

    res
      .status(200)
      .type("application/vnd.apple.pkpass")
      .set("Content-Disposition", 'attachment; filename="alcazaren.pkpass"')
      .send(pass.getAsBuffer());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo generar el pase" });
  }
});

module.exports = router;
