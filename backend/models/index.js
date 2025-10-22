// backend/models/index.js
const path = require("path");
const { Sequelize } = require("sequelize");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const sslMode = String(process.env.DB_SSL || '').toLowerCase();
const dialectOptions = {};

if (["require", "required", "true"].includes(sslMode)) {
  const ssl = { require: true, rejectUnauthorized: false };
  if (Object.prototype.hasOwnProperty.call(process.env, "DB_SSL_REJECT_UNAUTHORIZED")) {
    ssl.rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED).toLowerCase() === "true";
  }
  if (process.env.DB_SSL_CA_B64) {
    ssl.ca = Buffer.from(process.env.DB_SSL_CA_B64, "base64").toString("utf8");
  }
  dialectOptions.ssl = ssl;
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    dialect: "postgres",
    logging: false,
    dialectOptions,
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
// (Quita/Comenta el authenticate para evitar que Render intente PostgreSQL siempre)
// sequelize
//   .authenticate()
//   .then(() => console.log("✅ Conectado a PostgreSQL"))
//   .catch((err) => console.error("❌ Error en conexión:", err));

// ---- Ejecutar asociaciones (si el modelo las define) ----
Object.values(db).forEach((m) => m && m.associate && m.associate(db));

module.exports = db;
