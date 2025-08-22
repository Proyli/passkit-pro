// backend/src/routes/analytics.js
const express = require("express");
const router = express.Router();
const db = require("../../models"); // { sequelize, Sequelize }

function detectPlatform(req) {
  const q = String(req.query.platform || "").toLowerCase();
  if (q === "apple" || q === "ios") return "apple";
  if (q === "google" || q === "android") return "google";
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  if (/iphone|ipad|ipod|ios/.test(ua)) return "apple";
  if (/android|google/.test(ua)) return "google";
  return "unknown";
}

// POST /api/telemetry/scan
router.post("/telemetry/scan", async (req, res) => {
  try {
    const platform = detectPlatform(req);
    const { member_id = null, pass_id = null, source = "qr" } = req.body || {};
    await db.sequelize.query(
      `INSERT INTO telemetry_events
         (member_id, pass_id, platform, source, event_type, user_agent, ip_address, createdAt)
       VALUES (?, ?, ?, ?, 'scan', ?, ?, NOW())`,
      {
        replacements: [
          member_id,
          pass_id,
          platform,
          source,
          req.headers["user-agent"] || null,
          req.headers["x-forwarded-for"] || req.ip || null,
        ],
        type: db.Sequelize.QueryTypes.INSERT,
      }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("telemetry scan error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/telemetry/install
router.post("/telemetry/install", async (req, res) => {
  try {
    const platform = detectPlatform(req);
    const { member_id = null, pass_id = null, source = "link" } = req.body || {};
    await db.sequelize.query(
      `INSERT INTO telemetry_events
         (member_id, pass_id, platform, source, event_type, user_agent, ip_address, createdAt)
       VALUES (?, ?, ?, ?, 'install', ?, ?, NOW())`,
      {
        replacements: [
          member_id,
          pass_id,
          platform,
          source,
          req.headers["user-agent"] || null,
          req.headers["x-forwarded-for"] || req.ip || null,
        ],
        type: db.Sequelize.QueryTypes.INSERT,
      }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("telemetry install error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/analytics/overview", async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || new Date().toISOString().slice(0, 10);

  const qTotals = `
    SELECT
      SUM(event_type='scan')      AS scans,
      SUM(event_type='install')   AS installs,
      SUM(event_type='uninstall') AS uninstalls,
      SUM(event_type='delete')    AS deleted
    FROM telemetry_events
    WHERE DATE(createdAt) BETWEEN ? AND ?;
  `;
  const qPie = `
    SELECT platform, COUNT(*) AS c
    FROM telemetry_events
    WHERE event_type='scan' AND DATE(createdAt) BETWEEN ? AND ?
    GROUP BY platform;
  `;
  const qSeries = `
    SELECT DATE(createdAt) AS d,
           SUM(event_type='scan')      AS scans,
           SUM(event_type='install')   AS installs,
           SUM(event_type='uninstall') AS uninstalls,
           SUM(event_type='delete')    AS deleted
    FROM telemetry_events
    WHERE DATE(createdAt) BETWEEN ? AND ?
    GROUP BY DATE(createdAt)
    ORDER BY d ASC;
  `;

  try {
    const [totals] = await db.sequelize.query(qTotals, {
      replacements: [from, to],
      type: db.Sequelize.QueryTypes.SELECT,
    });
    const pie = await db.sequelize.query(qPie, {
      replacements: [from, to],
      type: db.Sequelize.QueryTypes.SELECT,
    });
    const series = await db.sequelize.query(qSeries, {
      replacements: [from, to],
      type: db.Sequelize.QueryTypes.SELECT,
    });

    res.json({
      ok: true,
      range: { from, to },
      totals: totals || { scans: 0, installs: 0, uninstalls: 0, deleted: 0 },
      byPlatform: pie,
      series,
    });
  } catch (e) {
    console.error("overview error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
