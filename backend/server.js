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
const walletRoutesV2     = require(path.join(__dirname, "src", "routes", "wallet_v2"));
const walletRoutes       = require(path.join(__dirname, "src", "routes", "wallet"));
const analyticsRoutes    = require("./src/routes/analytics");
const telemetryRoutes    = require("./src/routes/telemetry");
const { router: distributionRouter } = require("./routes/distribution");
const adminRoutes        = require("./routes/admin");
const { rateLimit }      = require("./middleware/auth");
// Load applePass routes conditionally: missing Apple certs should not crash the server in dev
let applePassRoutes = null;
try {
  applePassRoutes = require("./routes/applePass");
} catch (e) {
  console.warn("[server] applePass routes not loaded:", e?.message || e);
}

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
// Monta primero la versión v2 (override con mejoras de banner e info)
app.use("/api",         walletRoutesV2);
app.use("/api",         walletRoutes);
app.use("/api",         barcodeRouter);
app.use("/api",         analyticsRoutes);
app.use("/api",         telemetryRoutes);
app.use("/api",         distributionRouter);
// Rate limit admin endpoints to reduce abuse
app.use("/api",         rateLimit({ windowMs: 15*60*1000, max: 200 }), adminRoutes);
if (applePassRoutes) {
  app.use("/api", applePassRoutes);
} else {
  console.warn('[server] Skipping applePass routes (certs missing or module failed to load)');
}
app.use("/applews", require("./routes/applews"));


/* ---- Extras útiles ---- */
app.get("/", (_req, res) => res.status(200).send("PassForge backend up")); // ping rápido
// Healthcheck (ambas rutas por compatibilidad: raíz y bajo /api)
app.get(["/health", "/api/health"], (_req, res) => {
  res.status(200).json({ ok: true });
});

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
      console.log("🗄️  DB autenticada (conexión OK).");
      // Permite desactivar el sync alter si está dando problemas en producción
      const doSync = String(process.env.DB_SYNC_ALTER || 'true').toLowerCase() !== 'false';
      if (doSync) {
        try {
          await db.sequelize.sync({ alter: true });
          console.log("🗄️  DB sincronizada (alter=true).");
        } catch (syncErr) {
          console.warn("⚠️  DB sync (alter) falló, pero se continúa con la conexión:", syncErr.message);
        }
      } else {
        console.log("⏭️  DB_SYNC_ALTER=false → se omite sync(alter)");
      }
    } else {
      console.warn("⏭️  DB_HOST no definido o es 127.0.0.1 → se omite la conexión.");
      process.env.SKIP_DB = "true";
    }
  } catch (err) {
    console.error("⚠️  Falló la conexión a DB, pero el servidor seguirá:", err.message);
    // Permite operar sin DB (GET /api/members devolverá []), útil para health y front
    process.env.SKIP_DB = "true";
  }

  // ===== Seed: crear/actualizar usuarios predeterminados (solo si hay DB) =====
  try {
    if (process.env.SKIP_DB !== "true") {
      const bcrypt = require("bcryptjs");
      const { nanoid } = require("nanoid");
      const Member = db.Member;
      if (Member && typeof Member.findOne === "function") {
        // Helper para crear/actualizar un usuario
        const ensureUser = async ({ email, role = "user", password, nombre, apellido }) => {
          if (!email) return;
          const exists = await Member.findOne({ where: { email } });
          const pass = password || process.env.SEED_USER_PASSWORD || "Temporal#2024"; // valor por defecto
          if (!exists) {
            const hash = await bcrypt.hash(pass, 10);
            await Member.create({
              external_id: nanoid(10),
              nombre: nombre || (role === "admin" ? "Admin" : "Usuario"),
              apellido: apellido || "",
              email,
              role,
              password: hash,
              codigoCliente: null,
              codigoCampana: null,
              tipoCliente: "blue",
            });
            console.log(`[seed] Usuario creado: ${email} (role=${role})`);
          } else {
            const updates = {};
            if (!exists.password) {
              updates.password = await bcrypt.hash(pass, 10);
            }
            if (!exists.role && role) updates.role = role;
            if (Object.keys(updates).length) {
              await exists.update(updates);
              console.log(`[seed] Usuario actualizado: ${email} (${Object.keys(updates).join(', ')})`);
            }
          }
        };

        // 1) Admin principal (puede configurarse por variables de entorno)
        await ensureUser({
          email: process.env.SEED_ADMIN_EMAIL || "admin@alcazaren.com.gt",
          role: "admin",
          password: process.env.SEED_ADMIN_PASSWORD || process.env.SEED_USER_PASSWORD || "Temporal#2024",
          nombre: "Admin",
        });

        // 2) Usuario estándar por defecto (como antes)
        await ensureUser({
          email: process.env.SEED_USER_EMAIL || "ventas1.digital@alcazaren.com.gt",
          role: process.env.SEED_USER_ROLE || "user",
          password: process.env.SEED_USER_PASSWORD || "Temporal#2024",
          nombre: "Ventas",
          apellido: "Digital",
        });

        // 3) Otros usuarios de ejemplo (opcionales)
        const extra = (process.env.SEED_EXTRA_USERS || "andrea@alcazaren.com.gt,julio@alcazaren.com.gt,linda.perez@alcazaren.com.gt")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
        for (const mail of extra) {
          await ensureUser({ email: mail, role: "user" });
        }
      }
    }
  } catch (e) {
    console.warn("[seed] fallo al asegurar usuarios:", e?.message || e);
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
