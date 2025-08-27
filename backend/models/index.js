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

// Probar conexión (opcional)
sequelize
  .authenticate()
  .then(() => console.log("✅ Conectado a MySQL"))
  .catch((err) => console.error("❌ Error en conexión:", err));

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// ---- Cargar modelos ----
db.Member = require("./member")(sequelize, Sequelize);
db.Pass   = require("./pass")(sequelize, Sequelize);
// Ajusta el nombre del archivo según tu proyecto: "Design.js" o "design.js"
db.Design = require("./Design")(sequelize, Sequelize);

// ---- Ejecutar asociaciones (si el modelo las define) ----
Object.values(db).forEach((m) => m && m.associate && m.associate(db));

// Exporta el contenedor de modelos
module.exports = db;
