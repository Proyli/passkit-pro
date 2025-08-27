// backend/server.js
const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const memberRoutes  = require("./routes/memberRoutes");
const authRoutes    = require("./routes/authRoutes");
const csvRoutes     = require("./routes/csvRoutes");
const passRoutes    = require("./routes/passRoutes");
const barcodeRouter = require("./routes/barcode");
const designRoutes  = require("./routes/designRoutes");
const walletRoutes  = require(path.join(__dirname, "src", "routes", "wallet"));
const analyticsRoutes = require("./src/routes/analytics");
const { router: distributionRouter } = require("./routes/distribution");

const db = require("./models");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api/members", memberRoutes);
app.use("/api/auth",    authRoutes);
app.use("/api/csv",     csvRoutes);
app.use("/api/passes",  passRoutes);
app.use("/api/designs", designRoutes);
app.use("/api",         walletRoutes);
app.use("/api",         barcodeRouter);
app.use("/api",         analyticsRoutes);
app.use("/api",         distributionRouter);

app.get("/health", (_req, res) => res.status(200).send("OK"));

const PORT = process.env.PORT || 3900;

async function start() {
  const skipDb = process.env.SKIP_DB === "true";
  try {
    if (skipDb) {
      console.warn("⏭️  SKIP_DB=true → no se conectará a la base por ahora.");
    } else if (process.env.DB_HOST && process.env.DB_HOST !== "127.0.0.1") {
      await db.sequelize.authenticate();
      await db.sequelize.sync({ alter: true });
      console.log("🗄️  DB conectada y sincronizada.");
    } else {
      console.warn("⏭️  DB_HOST no definido o es 127.0.0.1 → se omite la conexión en Render.");
    }
  } catch (err) {
    console.error("⚠️  Falló la conexión a DB, pero el servidor seguirá:", err.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ API escuchando en puerto ${PORT}`);
  });
}

start();
