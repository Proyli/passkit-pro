const express = require("express");
const router = express.Router();

const db = require("../models");

function assertAuth(req, res) {
  const token = req.query.token || req.headers["x-admin-token"];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return false;
  }
  return true;
}

router.post("/admin/fix-members-schema", async (req, res) => {
  if (!assertAuth(req, res)) return;

  const qi = db.sequelize.getQueryInterface();
  const Sequelize = db.Sequelize;
  const added = [];

  async function addIfMissing(table, column, spec) {
    try {
      const desc = await qi.describeTable(table);
      if (!desc || !Object.prototype.hasOwnProperty.call(desc, column)) {
        await qi.addColumn(table, column, spec);
        added.push(column);
      }
    } catch (e) {
      // Si la tabla no existe, créala a partir del modelo
      if (String(e.message || e).includes("does not exist") || String(e.message || e).includes("relation \"")) {
        await db.Member.sync({ alter: true });
        const desc2 = await qi.describeTable(table);
        if (!Object.prototype.hasOwnProperty.call(desc2, column)) {
          await qi.addColumn(table, column, spec);
          added.push(column);
        }
      } else {
        throw e;
      }
    }
  }

  try {
    await db.sequelize.authenticate();

    await addIfMissing("members", "external_id", { type: Sequelize.STRING, allowNull: false, unique: true });
    await addIfMissing("members", "nombre", { type: Sequelize.STRING });
    await addIfMissing("members", "apellido", { type: Sequelize.STRING });
    await addIfMissing("members", "fechaNacimiento", { type: Sequelize.STRING });
    await addIfMissing("members", "codigoCliente", { type: Sequelize.STRING });
    await addIfMissing("members", "codigoCampana", { type: Sequelize.STRING });
    await addIfMissing("members", "tipoCliente", { type: Sequelize.STRING });
    await addIfMissing("members", "email", { type: Sequelize.STRING });
    await addIfMissing("members", "telefono", { type: Sequelize.STRING });
    await addIfMissing("members", "puntos", { type: Sequelize.INTEGER, defaultValue: 0 });
    await addIfMissing("members", "genero", { type: Sequelize.STRING });
    await addIfMissing("members", "createdAt", { type: Sequelize.DATE, defaultValue: Sequelize.NOW });
    await addIfMissing("members", "updatedAt", { type: Sequelize.DATE, defaultValue: Sequelize.NOW });

    res.json({ ok: true, added });
  } catch (e) {
    console.error("[admin] fix-members-schema error:", e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

module.exports = router;
 
// Extra: inspeccionar el esquema de members
router.get("/admin/inspect-members", async (req, res) => {
  if (!assertAuth(req, res)) return;
  try {
    const qi = db.sequelize.getQueryInterface();
    const desc = await qi.describeTable("members");
    res.json({ ok: true, columns: desc });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// Fuerza ALTER TABLE con nombres entrecomillados (Postgres es sensible a mayúsculas en identificadores entre comillas)
router.post("/admin/force-fix-members", async (req, res) => {
  if (!assertAuth(req, res)) return;
  try {
    const q = db.sequelize.query.bind(db.sequelize);
    const stmts = [
      'CREATE TABLE IF NOT EXISTS "members" (id SERIAL PRIMARY KEY);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "external_id" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "nombre" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "apellido" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "fechaNacimiento" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "codigoCliente" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "codigoCampana" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "tipoCliente" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "telefono" VARCHAR(255);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "puntos" INTEGER DEFAULT 0;',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "genero" VARCHAR(50);',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();',
      'ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();',
      'ALTER TABLE "members" ALTER COLUMN "external_id" SET NOT NULL;',
      'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = \"members_external_id_key\") THEN ALTER TABLE "members" ADD CONSTRAINT "members_external_id_key" UNIQUE ("external_id"); END IF; END $$;'
    ];
    const results = [];
    for (const s of stmts) {
      try { await q(s); results.push({ ok: true, stmt: s }); } catch (e) { results.push({ ok: false, stmt: s, error: e.message }); }
    }
    res.json({ ok: true, results });
  } catch (e) {
    console.error("[admin] force-fix-members error:", e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

