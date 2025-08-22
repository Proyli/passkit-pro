const { Sequelize } = require("sequelize");
require("dotenv").config({ path: __dirname + "/../../.env" });

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

sequelize.authenticate()
  .then(() => console.log("✅ Conectado a MySQL"))
  .catch((err) => console.error("❌ Error en conexión:", err));

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.Member  = require("./member.js")(sequelize, Sequelize);
db.Pass    = require("./pass")(sequelize, Sequelize);

// 👇 REGISTRA AQUÍ EL MODELO DESIGN (ajusta el nombre del archivo si usas design.js)
db.Design  = require("./Design")(sequelize, Sequelize);

module.exports = db;
