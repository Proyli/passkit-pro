const { nanoid } = require("nanoid");
const db = require("../models");
const Member = db.Member;

// importa el servicio de correo
const { sendWelcomeEmail } = require("../services/distribution");

// Obtener todos los miembros
exports.getAllMembers = async (_req, res) => {
  try {
    const members = await Member.findAll({ order: [["id", "ASC"]] });

    const formattedMembers = members.map((m) => ({
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
    }));

    res.json(formattedMembers);
  } catch (error) {
    console.error("❌ Error al obtener miembros:", error);
    res.status(500).json({ error: "Error al obtener miembros" });
  }
};

// Crear un nuevo miembro
exports.createMember = async (req, res) => {
  try {
    console.log("🟡 Datos recibidos desde el frontend:", req.body);

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
          codigoCliente: newMember.codigoCliente,
          codigoCampana: newMember.codigoCampana,
          nombre: newMember.nombre,
          apellido: newMember.apellido,
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
    await Member.update(req.body, { where: { id: req.params.id } });
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
