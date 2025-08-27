// backend/models/index.js
const path = require("path");
const { Sequelize } = require("sequelize");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
  }
);

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// ---- Cargar modelos (respeta mayúsculas/minúsculas de los archivos) ----
db.Member = require("./Member")(sequelize, Sequelize);   // <-- M mayúscula
db.Pass   = require("./pass")(sequelize, Sequelize);

// Si REALMENTE existe Design.js en /models, mantenlo así;
// si tu archivo se llama distinto (p. ej. design.js), cambia el nombre aquí.
// Si no tienes ese modelo aún, comenta la línea.
try {
  db.Design = require("./Design")(sequelize, Sequelize);
} catch (e) {
  console.warn("Design model not found (ok):", e.message);
}

// ---- NO te conectes aquí. Lo hace server.js cuando SKIP_DB=false ----
// (Quita/Comenta el authenticate para evitar que Render intente MySQL siempre)
// sequelize
//   .authenticate()
//   .then(() => console.log("✅ Conectado a MySQL"))
//   .catch((err) => console.error("❌ Error en conexión:", err));

// ---- Ejecutar asociaciones (si el modelo las define) ----
Object.values(db).forEach((m) => m && m.associate && m.associate(db));

module.exports = db;
