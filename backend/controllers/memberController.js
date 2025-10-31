const { nanoid } = require("nanoid");
const db = require("../models");
const Member = db.Member;

// importa el servicio de correo
const { sendWelcomeEmail } = require("../routes/distribution");


// Obtener todos los miembros o uno por codigoCliente+codigoCampana
exports.getAllMembers = async (req, res) => {
  const mapOne = (m) => ({
    id: m.id,
    externalId: m.external_id,
    firstName: m.nombre,
    lastName: m.apellido,
    dateOfBirth: m.fechaNacimiento,
    clientCode: m.codigoCliente,
    campaignCode: m.codigoCampana,
    tier: m.tipoCliente,
    email: m.email,
    mobile: m.telefono,
    points: m.puntos,
    gender: m.genero,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  });

  // Modo resiliente: si se define SKIP_DB o el modelo no está disponible → responde vacío
  if (process.env.SKIP_DB === "true" || !Member || typeof Member.findAll !== "function") {
    const idClient = req.query.idClient || req.query.clientCode;
    const idCampaing = req.query.idCampaing || req.query.idCampaign || req.query.campaignCode;
    if (idClient && idCampaing) return res.status(404).json({ ok: false, error: "Miembro no encontrado" });
    return res.json([]);
  }

  try {
    const idClient = req.query.idClient || req.query.clientCode;
    const idCampaing = req.query.idCampaing || req.query.idCampaign || req.query.campaignCode;

    // Si vienen ambos códigos, responde solo ese miembro
    if (idClient && idCampaing) {
      const m = await Member.findOne({ where: { codigoCliente: idClient, codigoCampana: idCampaing } });
      if (!m) return res.status(404).json({ ok: false, error: "Miembro no encontrado" });
      return res.json(mapOne(m));
    }

    // Si no hay filtros, devuelve la lista completa
    const members = await Member.findAll({ order: [["id", "ASC"]] });
    res.json(members.map(mapOne));
  } catch (error) {
    console.error("❌ Error al obtener miembros:", error?.message || error);
    // Evitar 500 hacia el frontend: responde lista vacía para que la UI siga funcionando
    res.status(200).json([]);
  }
};

// Crear un nuevo miembro
exports.createMember = async (req, res) => {
  try {
    console.log("[member] Datos recibidos desde el frontend:", req.body);

    const externalId = nanoid(10);

    const memberData = {
      external_id: externalId,
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      fechaNacimiento: req.body.fechaNacimiento || null,
      codigoCliente: req.body.codigoCliente || null,
      codigoCampana: req.body.codigoCampana || null,
      tipoCliente: req.body.tipoCliente || null,
      email: req.body.email || null,
      telefono: req.body.telefono || null,
      puntos: req.body.puntos || 0,
      genero: req.body.genero || null,
    };

    const newMember = await Member.create(memberData);

    // Respondemos rápido al frontend
    res.status(201).json({
      message: "Miembro creado exitosamente",
      member: newMember,
      externalId,
    });

    // 🚀 Dispara el email en background (no bloqueante)
    // Pasa todo el objeto o solo el id; el servicio acepta ambos.
    if (newMember.email) {
      setImmediate(() =>
        sendWelcomeEmail({
          id: newMember.id,
          external_id: newMember.external_id,
          externalId: newMember.external_id,
          codigoCliente: newMember.codigoCliente,
          codigoCampana: newMember.codigoCampana,
          nombre: newMember.nombre,
          apellido: newMember.apellido,
          tipoCliente: newMember.tipoCliente,
          email: newMember.email,
        }).catch((err) =>
          console.error("sendWelcomeEmail error:", err?.message || err)
        )
      );
    }
  } catch (error) {
    console.error("❌ Error al crear el miembro:", error);
    res.status(500).json({ error: "Error al crear el miembro" });
  }
};

// Actualizar un miembro
exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    await Member.update(req.body, { where: { id } });

    // Si actualizaron tipoCliente, reflejar color en los passes del miembro
    if (req.body && typeof req.body.tipoCliente !== "undefined") {
      try {
        const db = require("../models");
        const Pass = db.Pass;
        if (Pass) {
          const mapTierToColor = (raw) => {
            const s = String(raw || "").toLowerCase();
            if (s.includes("gold") || s.includes("oro") || s.includes("15")) return "#DAA520"; // Gold
            return "#2350C6"; // Blue por defecto
          };
          const bg = mapTierToColor(req.body.tipoCliente);
          await Pass.update({ backgroundColor: bg }, { where: { member_id: id } });
        }
      } catch (e) {
        console.warn("[members] no se pudieron actualizar colores de passes del miembro", id, e?.message || e);
      }
    }

    res.json({ message: "Miembro actualizado correctamente" });
  } catch (error) {
    console.error("❌ Error al actualizar el miembro:", error);
    res.status(500).json({ error: "Error al actualizar el miembro" });
  }
};

// Eliminar un miembro
exports.deleteMember = async (req, res) => {
  try {
    await Member.destroy({ where: { id: req.params.id } });
    res.json({ message: "Miembro eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar el miembro:", error);
    res.status(500).json({ error: "Error al eliminar el miembro" });
  }
};

// Asignar tarjeta a un miembro
exports.assignCardToMember = async (req, res) => {
  try {
    const { clientCode, campaignCode } = req.body;
    if (!clientCode || !campaignCode) {
      return res
        .status(400)
        .json({ error: "Faltan campos obligatorios (clientCode o campaignCode)" });
    }

    const member = await Member.findOne({ where: { codigoCliente: clientCode } });
    if (!member) {
      return res.status(404).json({ error: "Miembro no encontrado con ese código de cliente" });
    }

    member.codigoCampana = campaignCode;
    await member.save();

    res.json({ message: "Tarjeta asignada correctamente", member });
  } catch (error) {
    console.error("❌ Error al asignar tarjeta:", error);
    res.status(500).json({ error: "Error al asignar tarjeta al miembro" });
  }
};
