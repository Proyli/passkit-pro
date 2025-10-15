// backend/controllers/passController.js
const db = require("../models"); // { sequelize, Sequelize, Pass, Member }
const Pass = db.Pass;
const Member = db.Member;

/**
 * POST /api/passes
 * Crea un pass. Puedes enviar member_id para relacionarlo al miembro.
 */
// backend/controllers/passController.js (createPass)
exports.createPass = async (req, res) => {
  try {
    const status = req.body.status ?? req.body.estado ?? "active";
    const TYPE_MAP = { "Loyalty Card": "loyalty", "Coupon": "coupon", "Event Ticket": "event" };
    const type = TYPE_MAP[req.body.type] ?? req.body.type ?? "loyalty";

    const body = {
      title: req.body.title,
      description: req.body.description,
      type,
      status,
      backgroundColor: req.body.backgroundColor ?? "#007AFF",
      textColor: req.body.textColor ?? "#FFFFFF",
      fields: req.body.fields ? JSON.stringify(req.body.fields) : null,
    };

    // 👇 solo añade member_id si el modelo/columna existe y vino en el body
    if (db.Pass?.rawAttributes?.member_id && req.body.member_id != null) {
      body.member_id = req.body.member_id;
    }

    if (!body.title || !body.description || !body.type) {
      return res.status(400).json({ ok: false, error: "title, description y type son requeridos" });
    }

    const created = await db.Pass.create(body);

    const passWithMember = await db.Pass.findByPk(created.id, {
      include: [{
        model: db.Member,
        as: "member",
        attributes: ["id", "external_id", "codigoCliente", "codigoCampana"]
      }],
    });

    const out = passWithMember.toJSON();
    if (typeof out.fields === "string") {
      try { out.fields = JSON.parse(out.fields); } catch { out.fields = {}; }
    }

    return res.status(201).json(out);
  } catch (error) {
    console.error("Error creating pass:", error);
    // 🔎 devuelve detalle para verlo en Network → Response
    return res.status(500).json({
      ok: false,
      error: error?.original?.sqlMessage || error?.message || String(error),
    });
  }
};


/**
 * GET /api/passes
 * Lista todos los passes con su member (id, codigoCliente, codigoCampana).
 */
exports.getAllPasses = async (_req, res) => {
  try {
    const rows = await Pass.findAll({
      order: [["id", "ASC"]],
      // incluir tipoCliente para poder decidir color en el servidor
      include: [{
        model: Member,
        as: "member",
        attributes: ["id", "external_id", "codigoCliente", "codigoCampana", "tipoCliente"]
      }],
    });

    const mapTierToColor = (raw) => {
      if (!raw) return "#2350C6"; // default blue
      const s = String(raw).toLowerCase();
      if (s.includes("gold")) return "#DAA520"; // gold
      if (s.includes("silver")) return "#C0C0C0"; // silver
      if (s.includes("bronze") || s.includes("bronce")) return "#CD7F32"; // bronze
      return "#2350C6";
    };

    const data = rows.map((r) => {
      const j = r.toJSON();
      if (typeof j.fields === "string") {
        try { j.fields = JSON.parse(j.fields); } catch { j.fields = {}; }
      }
      j.status = j.status ?? j.estado ?? "active";

      // Si el pass no trae backgroundColor, derivarlo a partir del tipo de cliente del member
      try {
        if (!j.backgroundColor) {
          const memberTier = j.member && (j.member.tipoCliente || j.member.tipo || null);
          j.backgroundColor = mapTierToColor(memberTier);
        }
      } catch (e) {
        // defensivo: no fallar la respuesta por un problema menor al mapear color
        console.warn("warning mapping backgroundColor for pass", j.id, e?.message || e);
        if (!j.backgroundColor) j.backgroundColor = "#2350C6";
      }

      // no forzar por título si ya hay color establecido

      return j;
    });

    return res.json(data);
  } catch (error) {
    console.error("getAllPasses error:", error);
    return res.status(500).json({ ok: false, error: "Error al obtener los pases" });
  }
};

/**
 * GET /api/passes/:id
 * Devuelve un pass por id (incluye member básico)
 */
exports.getPassById = async (req, res) => {
  try {
    const id = req.params.id;
    const row = await Pass.findByPk(id, {
      include: [{
        model: Member,
        as: "member",
        attributes: ["id", "external_id", "codigoCliente", "codigoCampana", "tipoCliente"]
      }],
    });
    if (!row) return res.status(404).json({ ok: false, message: "Pass no encontrado" });

    const j = row.toJSON();
    if (typeof j.fields === "string") {
      try { j.fields = JSON.parse(j.fields); } catch { j.fields = {}; }
    }
    j.status = j.status ?? j.estado ?? "active";

    const mapTierToColor = (raw) => {
      if (!raw) return "#2350C6"; // default blue
      const s = String(raw).toLowerCase();
      if (s.includes("gold")) return "#DAA520"; // gold
      if (s.includes("silver")) return "#C0C0C0"; // silver
      if (s.includes("bronze") || s.includes("bronce")) return "#CD7F32"; // bronze
      return "#2350C6";
    };
    try {
      if (!j.backgroundColor) {
        const memberTier = j.member && (j.member.tipoCliente || j.member.tipo || null);
        j.backgroundColor = mapTierToColor(memberTier);
      }
    } catch {}

    // no forzar por título si ya hay color establecido

    return res.json(j);
  } catch (e) {
    console.error("getPassById error:", e);
    return res.status(500).json({ ok: false, error: "Error al obtener el pass" });
  }
};

/**
 * DELETE /api/passes/:id
 */
exports.deletePass = async (req, res) => {
  try {
    const { id } = req.params;
    const n = await Pass.destroy({ where: { id } });
    if (!n) return res.status(404).json({ ok: false, error: "Pass no encontrado" });
    return res.json({ ok: true });
  } catch (error) {
    console.error("deletePass error:", error);
    return res.status(500).json({ ok: false, error: "Error al eliminar pase" });
  }
};

/**
 * PUT /api/passes/:id
 * Actualiza campos básicos del pass
 */
exports.updatePass = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "title",
      "description",
      "type",
      "status",
      "backgroundColor",
      "textColor",
      "fields",
    ];
    const payload = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    }
    if (payload.fields && typeof payload.fields !== "string") {
      try { payload.fields = JSON.stringify(payload.fields); } catch {}
    }

    const [n] = await Pass.update(payload, { where: { id } });
    if (!n) return res.status(404).json({ ok: false, error: "Pass no encontrado" });

    const fresh = await Pass.findByPk(id, { include: [{ model: Member, as: "member" }] });
    return res.json(fresh);
  } catch (e) {
    console.error("updatePass error:", e);
    return res.status(500).json({ ok: false, error: "Error al actualizar pass" });
  }
};
/**
 * (Opcional) PUT /api/passes/:id/assign-member
 * Vincula un pass a un member.
 */
exports.assignMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { member_id } = req.body;

    if (!member_id) return res.status(400).json({ ok: false, error: "member_id es requerido" });

    const pass = await Pass.findByPk(id);
    if (!pass) return res.status(404).json({ ok: false, error: "Pass no encontrado" });

    const member = await Member.findByPk(member_id);
    if (!member) return res.status(404).json({ ok: false, error: "Member no encontrado" });

    await pass.update({ member_id });

    const out = await Pass.findByPk(id, {
      include: [{
        model: Member,
        as: "member",
        attributes: ["id", "external_id", "codigoCliente", "codigoCampana"]
      }],
    });
    return res.json(out);
  } catch (e) {
    console.error("assignMember error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
