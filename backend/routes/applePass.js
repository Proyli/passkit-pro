// backend/routes/applePass.js
const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const { PKPass } = require("passkit-generator");

const router = express.Router();

// ⬇️ AQUÍ van tus líneas de certificados (justo debajo de los imports)
// base = carpeta "backend"
const BASE      = path.resolve(__dirname, "..");
const CERT_DIR  = path.join(BASE, "certs");
const MODEL_DIR = path.join(BASE, "passes", "alcazaren.pass");

console.log("CERT_DIR:", CERT_DIR);
console.log("MODEL_DIR:", MODEL_DIR);


const wwdr       = fs.readFileSync(path.join(CERT_DIR, "AppleWWDR.pem"));
const signerCert = fs.readFileSync(path.join(CERT_DIR, "pass_cert.pem"));
const signerKey  = fs.readFileSync(path.join(CERT_DIR, "pass_private.key"));
const signerKeyPassphrase = process.env.PASS_KEY_PASSPHRASE || undefined;

// Ruta que devuelve el .pkpass
// Ruta que devuelve el .pkpass
router.get("/apple/pass/:serial", async (req, res) => {
  try {
    const displayName  = req.query.displayName || req.query.name || "Cliente";
    const membershipId = req.query.membershipId || req.query.mid || req.params.serial;

    const pass = await PKPass.from(
      {
        model: MODEL_DIR,
        certificates: { wwdr, signerCert, signerKey, signerKeyPassphrase },
      },
      {
        // === Identidad ===
        serialNumber: membershipId,

        // === Código de barras: CODE128 (NO QR) ===
        barcodes: [
          {
            format: "PKBarcodeFormatCode128",
            message: `PK|${membershipId}|ALCAZAREN`,
            messageEncoding: "iso-8859-1",
            altText: membershipId,
          },
        ],

        // === Campos storeCard: se ven como tu diseño “largo” ===
        storeCard: {
          primaryFields: [
            { key: "title", label: "Lealtad Alcazarén", value: "Lealtad Alcazarén" },
          ],
          secondaryFields: [
            { key: "name", label: "Name", value: displayName },
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

        // (opcional) Colores/logoText si tu modelo no los fija
        // foregroundColor: "rgb(255,255,255)",
        // backgroundColor: "rgb(16,43,70)",
        // logoText: "Distribuidora Alcazarén",
      }
    );

    res
      .status(200)
      .type("application/vnd.apple.pkpass")
      .set("Content-Disposition", 'attachment; filename="alcazaren.pkpass"')
      .send(await pass.asBuffer()); // 👈 mejor usar asBuffer() async
  } catch (e) {
    console.error("apple/pass error:", e);
    res.status(500).json({ error: "No se pudo generar el pase" });
  }
});


module.exports = router;
