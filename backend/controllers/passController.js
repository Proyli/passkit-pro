// backend/controllers/passController.js
const db = require("../models");
const Pass = db.Pass;

// POST /api/passes
exports.createPass = async (req, res) => {
  try {
    // normaliza status (acepta "estado" o "status")
    const status = req.body.status ?? req.body.estado ?? "active";

    // mapea etiquetas visibles a códigos que guarda la BD
    const TYPE_MAP = { "Loyalty Card": "loyalty", "Coupon": "coupon", "Event Ticket": "event" };
    const type = TYPE_MAP[req.body.type] ?? req.body.type ?? "loyalty";

    const newPass = await Pass.create({
      title: req.body.title,
      description: req.body.description,
      type,
      status,
      // si añadiste estas columnas en la tabla:
      backgroundColor: req.body.backgroundColor ?? "#007AFF",
      textColor: req.body.textColor ?? "#FFFFFF",
      // 👇 fields se guarda como string (TEXT)
      fields: req.body.fields ? JSON.stringify(req.body.fields) : null,
      scans: req.body.scans ?? 0,
    });

    // responde con fields parseado a objeto
    const out = newPass.toJSON();
    if (typeof out.fields === "string") {
      try { out.fields = JSON.parse(out.fields); } catch { out.fields = {}; }
    }
    res.status(201).json(out);
  } catch (error) {
    console.error("Error creating pass:", error);
    res.status(400).json({ error: error.message });
  }
};

// GET /api/passes
exports.getAllPasses = async (_req, res) => {
  try {
    const rows = await Pass.findAll({ order: [["id", "ASC"]] });
    const data = rows.map(r => {
      const j = r.toJSON();
      if (typeof j.fields === "string") {
        try { j.fields = JSON.parse(j.fields); } catch { j.fields = {}; }
      }
      // por compatibilidad si aún llega "estado" en algunos registros antiguos
      j.status = j.status ?? j.estado ?? "active";
      return j;
    });
    res.status(200).json(data);
  } catch (error) {
    console.error("Error al obtener los pases:", error);
    res.status(500).json({ error: "Error al obtener los pases" });
  }
};


exports.deletePass = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar el pase
    const pass = await Pass.findByPk(id);
    if (!pass) {
      return res.status(404).json({ message: "Pase no encontrado" });
    }

    // Eliminar
    await pass.destroy();
    res.status(200).json({ message: "Pase eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar pase:", error);
    res.status(500).json({ error: "Error al eliminar pase" });
  }
};
