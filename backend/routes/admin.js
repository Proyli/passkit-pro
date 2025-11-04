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

