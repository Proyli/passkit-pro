// backend/src/routes/telemetry.js
const express = require("express");
const router = express.Router();

// No-op endpoint: acepta telemetría pero no la persiste
// Útil en desarrollo o cuando la DB no está lista.
router.post("/telemetry/install", (req, res) => {
  try {
    const payload = req.body || {};
    // Log suave para diagnóstico (truncado)
    try {
      const copy = { ...payload };
      if (copy?.token) delete copy.token;
      console.log("[telemetry/install]", JSON.stringify(copy));
    } catch {}
    return res.json({ ok: true });
  } catch (e) {
    // Aun si algo raro pasa, no queremos romper el front
    return res.json({ ok: true });
  }
});

// GET para ver rápido en el navegador (comodidad)
router.get("/telemetry/install", (_req, res) => {
  res.json({ ok: true });
});

module.exports = router;
