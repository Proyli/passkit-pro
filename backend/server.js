// backend/server.js
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });

/* ==== DB ==== */
const db = require("./models");

/* ==== Rutas ==== */
const memberRoutes       = require("./routes/memberRoutes");
const authRoutes         = require("./routes/authRoutes");
const csvRoutes          = require("./routes/csvRoutes");
const passRoutes         = require("./routes/passRoutes");
const barcodeRouter      = require("./routes/barcode");
const designRoutes       = require("./routes/designRoutes");
const walletRoutes       = require(path.join(__dirname, "src", "routes", "wallet"));
const analyticsRoutes    = require("./src/routes/analytics");
const { router: distributionRouter } = require("./routes/distribution");
const applePassRoutes    = require("./routes/applePass");

/* ==== App ==== */
const app = express();
app.set("trust proxy", 1);

// CORS con whitelist opcional: CORS_ORIGINS="https://tu-frontend.com,https://otro.com"
const whitelist = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || whitelist.length === 0 || whitelist.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));

/* ==== STATIC: servir /public y raíz ==== */
const PUBLIC_DIR = path.join(__dirname, "public");
console.log("[STATIC] public dir exists:", fs.existsSync(PUBLIC_DIR), PUBLIC_DIR);
console.log("[STATIC] hero exists:", fs.existsSync(path.join(PUBLIC_DIR, "hero-alcazaren.jpeg")));

// Disponible en https://.../hero-alcazaren.jpeg
app.use(express.static(PUBLIC_DIR));
// Disponible en https://.../public/hero-alcazaren.jpeg
app.use("/public", express.static(PUBLIC_DIR));

// Ruta de diagnóstico (lista archivos en /public)
app.get("/__static", (_req, res) => {
  try {
    const files = fs.readdirSync(PUBLIC_DIR);
    res.json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ==== Rutas API ==== */
app.use("/api/members", memberRoutes);
app.use("/api/auth",    authRoutes);
app.use("/api/csv",     csvRoutes);
app.use("/api/passes",  passRoutes);
app.use("/api/designs", designRoutes);
app.use("/api",         walletRoutes);
app.use("/api",         barcodeRouter);
app.use("/api",         analyticsRoutes);
app.use("/api",         distributionRouter);
app.use("/api",         applePassRoutes);
app.use("/applews", require("./routes/applews"));


/* ---- Extras útiles ---- */
app.get("/", (_req, res) => res.status(200).send("PassForge backend up")); // ping rápido
app.get("/health", (_req, res) => res.status(200).send("OK"));             // healthcheck

// 404 handler (después de las rutas)
app.use((req, res, _next) => {
  res.status(404).json({ ok: false, message: "Not Found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "Internal server error",
  });
});

/* ==== Arranque ==== */
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

  // (Opcional) chequeo de certificados Apple si los necesitas ahora
  console.log("ENV CHECK → CERT_DIR:", process.env.CERT_DIR);
  console.log("ENV CHECK → MODEL_DIR:", process.env.MODEL_DIR);
  try {
    const CERTS = process.env.CERT_DIR || path.join(__dirname, "certs");
    console.log("exists wwdr.pem?      ", fs.existsSync(path.join(CERTS, "wwdr.pem")));
    console.log("exists signerCert.pem?", fs.existsSync(path.join(CERTS, "signerCert.pem")));
    console.log("exists signerKey.pem? ", fs.existsSync(path.join(CERTS, "signerKey.pem")));
  } catch {}

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ API escuchando en puerto ${PORT}`);
  });
}
start();
