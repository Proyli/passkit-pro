const { nanoid } = require("nanoid");
const db = require("../models");
const Member = db.Member;

// Obtener todos los miembros
exports.getAllMembers = async (req, res) => {
  try {
    const members = await Member.findAll({ order: [["id", "ASC"]] });

    // 🔁 Traducimos campos del backend en español → frontend en inglés
    const formattedMembers = members.map(member => ({
      id: member.id,
      externalId: member.external_id,
      firstName: member.nombre,
      lastName: member.apellido,
      dateOfBirth: member.fechaNacimiento,
      clientCode: member.codigoCliente,
      campaignCode: member.codigoCampaña,
      tier: member.tipoCliente,
      email: member.email,
      mobile: member.telefono,
      points: member.puntos,
      gender: member.genero,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt

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
      codigoCampaña: req.body.codigoCampaña || null,
      tipoCliente: req.body.tipoCliente,
      email: req.body.email,
      telefono: req.body.telefono,
      puntos: req.body.puntos,
      genero: req.body.genero,
      //eatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      //datedAt: null, // O new Date().toISOString() si prefieres

    };

    const newMember = await Member.create(memberData);

    res.json({
      message: "Miembro creado exitosamente",
      member: newMember,
      externalId
    });
  } catch (error) {
    console.error("❌ Error al crear el miembro:", error);
    res.status(500).json({ error: "Error al crear el miembro" });
  }
};
// Actualizar un miembro
exports.updateMember = async (req, res) => {
  try {
    await Member.update(req.body, {
      where: { id: req.params.id }
    });
    res.json({ message: "Miembro actualizado correctamente" });
  } catch (error) {
    console.error("❌ Error al actualizar el miembro:", error);
    res.status(500).json({ error: "Error al actualizar el miembro" });
  }
};

// Eliminar un miembro
exports.deleteMember = async (req, res) => {
  try {
    await Member.destroy({
      where: { id: req.params.id }
    });
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
      return res.status(400).json({ error: "Faltan campos obligatorios (clientCode o campaignCode)" });
    }

    // Buscar al miembro por su código de cliente
    const member = await Member.findOne({ where: { codigoCliente: clientCode } });

    if (!member) {
      return res.status(404).json({ error: "Miembro no encontrado con ese código de cliente" });
    }

    // Actualizar el código de campaña
    member.codigoCampaña = campaignCode;
    await member.save();

    res.json({ message: "Tarjeta asignada correctamente", member });
  } catch (error) {
    console.error("❌ Error al asignar tarjeta:", error);
    res.status(500).json({ error: "Error al asignar tarjeta al miembro" });
  }
};

