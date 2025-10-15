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

// Acepta formatos: YYYY-MM-DD (nativo), DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, D-M-YYYY
// Se prioriza interpretación día/mes/año cuando no es ISO.
function parseDateFlexible(s) {
  if (!s) return null;
  const str = String(s).trim();
  // 1) ISO date only
  const mIso = str.match(/^\d{4}-\d{2}-\d{2}$/);
  if (mIso) {
    const [y, mo, d] = str.split("-").map((v) => parseInt(v, 10));
    return new Date(y, mo - 1, d);
  }
  // 2) DMY con / o - (prioridad día/mes/año)
  const mDmyAny = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mDmyAny) {
    const d = parseInt(mDmyAny[1], 10);
    const mo = parseInt(mDmyAny[2], 10);
    const y = parseInt(mDmyAny[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(y, mo - 1, d);
      // valida que no haya overflow (ej 31/02)
      if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return dt;
    }
  }
  // fallback a Date.parse (menos confiable con locales)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

router.get("/analytics/overview", async (req, res) => {
  try {
    // rango: últimos 30 días si no mandan ?from&?to (YYYY-MM-DD)
    const qFrom = parseDateFlexible(req.query.from);
    const qTo   = parseDateFlexible(req.query.to);
    const today = new Date();

    let from = qFrom ?? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    let to   = qTo   ?? today;

    // Si el rango viene invertido, intercambiar
    if (from > to) {
      const t = from;
      from = to;
      to = t;
    }

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
