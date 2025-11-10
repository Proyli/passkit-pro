// routes/applews.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// lee de .env
const APPLE_TOKEN = process.env.APPLE_WS_TOKEN || "supersecreto";

/**
 * Helper: auth de Apple
 */
function checkAuth(req, res) {
  const auth = String(req.get("authorization") || "");
  if (!auth.startsWith("ApplePass ")) return false;
  const token = auth.slice("ApplePass ".length).trim();
  return token === APPLE_TOKEN;
}

/**
 * Helper: resolve member_id a partir del serialNumber que tú generas en iOS.
 * Serial en tu código: `${sanitize(client)}-${sanitize(campaign)}-${tier}`
 */
async function resolveMemberIdBySerial(serial) {
  try {
    const [client, campaign] = String(serial).split("-"); // tier no necesario
    if (!client || !campaign) return null;
    const [rows] = await pool.query(
      "SELECT id FROM members WHERE codigoCliente=? AND `codigoCampana`=? LIMIT 1",
      [client, campaign]
    );
    return rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Registrar dispositivo (→ instalación)
 * Spec: POST /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber
 */
router.post("/v1/devices/:dev/registrations/:ptid/:serial", async (req, res) => {
  try {
    if (!checkAuth(req, res)) return res.status(401).send("unauthorized");

    const { serial } = req.params;
    const userAgent = req.get("user-agent") || null;
    const ip = req.headers["x-forwarded-for"] || req.ip || null;

    const memberId = await resolveMemberIdBySerial(serial);

    // Guarda evento INSTALL (si ya existía, no pasa nada)
    await pool.query(
      `INSERT INTO telemetry_events
         (member_id, pass_id, platform, source, event_type, user_agent, ip_address, createdAt)
       VALUES ($1, $2, 'apple', 'link', 'install', $3, $4, NOW())`,
      [memberId, serial, userAgent, ip]
    );

    // Apple espera 201 Created si registraste este device/serial
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("applews install:", e?.message || e);
    return res.status(500).send("error");
  }
});

/**
 * Desregistrar dispositivo (→ opcional: uninstall)
 * DELETE /v1/devices/:dev/registrations/:ptid/:serial
 */
router.delete("/v1/devices/:dev/registrations/:ptid/:serial", async (req, res) => {
  try {
    if (!checkAuth(req, res)) return res.status(401).send("unauthorized");
    const { serial } = req.params;
    const userAgent = req.get("user-agent") || null;
    const ip = req.headers["x-forwarded-for"] || req.ip || null;

    const memberId = await resolveMemberIdBySerial(serial);

    await pool.query(
      `INSERT INTO telemetry_events
         (member_id, pass_id, platform, source, event_type, user_agent, ip_address, createdAt)
       VALUES ($1, $2, 'apple', 'link', 'uninstall', $3, $4, NOW())`,
      [memberId, serial, userAgent, ip]
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("applews uninstall:", e?.message || e);
    return res.status(500).send("error");
  }
});

// Endpoints mínimos extra que algunas apps consultan:
router.get("/v1/devices/:dev/registrations/:ptid", (req, res) => {
  // No enviamos actualizaciones push de contenido; devuelve 204 sin lista.
  res.status(204).end();
});
router.get("/v1/passes/:ptid/:serial", (req, res) => {
  // Si no implementas “pull de actualizaciones”, responde 204.
  res.status(204).end();
});

module.exports = router;
