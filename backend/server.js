// backend/server.js
const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Rutas
const memberRoutes  = require("./routes/memberRoutes");
const authRoutes    = require("./routes/authRoutes");
const csvRoutes     = require("./routes/csvRoutes");
const passRoutes    = require("./routes/passRoutes");
const barcodeRouter = require("./routes/barcode");
const designRoutes  = require("./routes/designRoutes"); // 👈 diseños
// wallet vive en backend/src/routes/wallet.js
const walletRoutes  = require(path.join(__dirname, "src", "routes", "wallet"));
const analyticsRoutes = require("./src/routes/analytics");

const db = require("./models");
db.sequelize.sync({ alter: true }).then(() => {
  console.log("🗄️  DB synced (Design creado/actualizado)");
});


const app = express();
app.use(cors());
app.use(express.json());

// estáticos
app.use("/public", express.static(path.join(__dirname, "public")));

// Rutas API
app.use("/api/members", memberRoutes);
app.use("/api/auth",    authRoutes);
app.use("/api/csv",     csvRoutes);
app.use("/api/passes",  passRoutes);     // 👈 pases
app.use("/api/designs", designRoutes);   // 👈 diseños
app.use("/api",         walletRoutes);   // /api/wallet/...
app.use("/api",         barcodeRouter);  // /api/barcode/...
app.use("/api", analyticsRoutes);

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 3900;
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
