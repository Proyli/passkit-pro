const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const { nanoid } = require("nanoid");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const db = require("../models");
const Member = db.Member;

const upload = multer({ dest: "uploads/" });

const normalizeRow = (raw) => {
  const pick = (...keys) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        const value = String(raw[key] ?? "").trim();
        if (value !== "") return value;
      }
    }
    return null;
  };

  const puntos = pick("puntos", "points", "point", "score");

  return {
    external_id: pick("idExterno", "externalId", "external_id", "externalID", "external") || nanoid(10),
    nombre: pick("nombre", "firstName", "name"),
    apellido: pick("apellido", "lastName", "surname"),
    fechaNacimiento: pick("fechaNacimiento", "fecha_nacimiento", "dateOfBirth", "dob"),
    email: pick("email", "correo", "mail"),
    telefono: pick("telefono", "phone", "mobile"),
    genero: pick("genero", "gender"),
    puntos: puntos ? Number(puntos) || 0 : 0,
  };
};

exports.importCSV = [
  upload.single("csvFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No se adjuntó ningún archivo" });
      }

      const results = [];
      const cleanup = () => {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      };

      // Leer archivo CSV
      fs.createReadStream(req.file.path)
        .pipe(csv({ mapHeaders: ({ header }) => String(header || "").trim() }))
        .on("data", (data) => results.push(data))
        .on("error", (err) => {
          cleanup();
          res.status(400).json({ error: `Error al leer el CSV: ${err.message}` });
        })
        .on("end", async () => {
          try {
            const cleanedRows = results.filter((row) =>
              Object.values(row || {}).some((v) => String(v || "").trim() !== "")
            );

            if (cleanedRows.length === 0) {
              cleanup();
              return res.status(400).json({ error: "El archivo CSV está vacío" });
            }

            const mappedMembers = cleanedRows.map(normalizeRow);

            // Verificar duplicados
            const idsToCheck = mappedMembers.map((row) => row.external_id).filter(Boolean);
            const existing = await Member.findAll({
              where: { external_id: idsToCheck },
              attributes: ["external_id"],
            });

            const existingIds = existing.map((member) => member.external_id);
            const newMembers = mappedMembers.filter(
              (row) => row.external_id && !existingIds.includes(row.external_id)
            );

            // Insertar nuevos miembros
            if (newMembers.length > 0) {
              await Member.bulkCreate(newMembers);
            }

            // Limpiar archivo temporal
            cleanup();

            res.json({
              message: `${newMembers.length} miembros importados correctamente`,
              duplicados: existingIds.length,
              total: mappedMembers.length,
            });
          } catch (error) {
            cleanup();
            res.status(500).json({ error: error.message });
          }
        });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
];

exports.exportCSV = async (req, res) => {
  try {
    const members = await Member.findAll();
    const records = members.map((m) => ({
      nombre: m.nombre,
      apellido: m.apellido,
      fechaNacimiento: m.fechaNacimiento,
      email: m.email,
      telefono: m.telefono,
      genero: m.genero,
      puntos: m.puntos,
      external_id: m.external_id,
    }));

    const csvWriter = createCsvWriter({
      path: "exports/members.csv",
      header: [
        { id: "nombre", title: "nombre" },
        { id: "apellido", title: "apellido" },
        { id: "fechaNacimiento", title: "fechaNacimiento" },
        { id: "email", title: "email" },
        { id: "telefono", title: "telefono" },
        { id: "genero", title: "genero" },
        { id: "puntos", title: "puntos" },
        { id: "external_id", title: "idExterno" },
      ],
    });

    await csvWriter.writeRecords(records);
    res.download("exports/members.csv");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};