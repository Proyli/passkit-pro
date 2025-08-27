// backend/src/routes/analytics.js
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// helpers
const pad = (n) => (n < 10 ? "0" + n : "" + n);
const toDateStart = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;
const toDateEnd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 23:59:59`;

const parseDateOnly = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

router.get("/analytics/overview", async (req, res) => {
  try {
    // rango: últimos 30 días si no mandan ?from&?to (YYYY-MM-DD)
    const qFrom = parseDateOnly(req.query.from);
    const qTo   = parseDateOnly(req.query.to);
    const today = new Date();

    const from = qFrom ?? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    const to   = qTo   ?? today;

    const fromSQL = toDateStart(from);
    const toSQL   = toDateEnd(to);

    // --- CONSULTAS (OJO: createdAt, no created_at) ---
    const totalsSql = `
      SELECT
        SUM(event_type='scan')      AS scans,
        SUM(event_type='install')   AS installs,
        SUM(event_type='uninstall') AS uninstalls,
        SUM(event_type='delete')    AS deleted
      FROM telemetry_events
      WHERE createdAt BETWEEN ? AND ?;
    `;

    const pieSql = `
      SELECT platform, COUNT(*) AS c
      FROM telemetry_events
      WHERE event_type='install'
        AND createdAt BETWEEN ? AND ?
      GROUP BY platform;
    `;

    const seriesSql = `
      SELECT DATE(createdAt) AS d,
             SUM(event_type='scan')      AS scans,
             SUM(event_type='install')   AS installs,
             SUM(event_type='uninstall') AS uninstalls,
             SUM(event_type='delete')    AS deleted
      FROM telemetry_events
      WHERE createdAt BETWEEN ? AND ?
      GROUP BY DATE(createdAt)
      ORDER BY d ASC;
    `;

    // ejecuta SIEMPRE con parámetros (evita errores de comillas / sintaxis)
    const [totalsRows] = await pool.query(totalsSql, [fromSQL, toSQL]);
    const totals = totalsRows?.[0] || { scans: 0, installs: 0, uninstalls: 0, deleted: 0 };

    const [platRows] = await pool.query(pieSql, [fromSQL, toSQL]);
    const wallets = { apple: 0, google: 0, unknown: 0 };
    for (const r of platRows || []) wallets[r.platform || "unknown"] = Number(r.c) || 0;

    const [seriesRows] = await pool.query(seriesSql, [fromSQL, toSQL]);
    const series = (seriesRows || []).map((r) => ({
      d: r.d,
      scans: Number(r.scans) || 0,
      installs: Number(r.installs) || 0,
      uninstalls: Number(r.uninstalls) || 0,
      deleted: Number(r.deleted) || 0,
    }));

    res.json({
      ok: true,
      range: { from: fromSQL.slice(0, 10), to: toSQL.slice(0, 10) },
      totals,
      wallets,
      byPlatform: (platRows || []).map((r) => ({ platform: r.platform || "unknown", c: Number(r.c) || 0 })),
      series,
    });
  } catch (e) {
    console.error("analytics/overview error:", e?.message || e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

module.exports = router;
