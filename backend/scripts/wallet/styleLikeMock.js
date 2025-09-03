// backend/scripts/wallet/styleLikeMock.js
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// Cargar backend/.env
require("dotenv").config({ path: path.join(__dirname, "../../", ".env") });

const issuerId  = process.env.GOOGLE_WALLET_ISSUER_ID;
const classBlue = process.env.GOOGLE_WALLET_CLASS_ID_BLUE;
const classGold = process.env.GOOGLE_WALLET_CLASS_ID_GOLD;

// ---- Colores y banner (ajusta si quieres) ----
const GOLD_BG = "#C08F5F";            // arena/dorado tipo mock
const BLUE_BG = "#0B1626";            // azul oscuro
const BANNER_URI = "https://raw.githubusercontent.com/Proyli/wallet-assets/main/celebre-banner.png";

// ---- Resolver credenciales (local/prod) ----
function resolveKeyJson() {
  if (process.env.GOOGLE_WALLET_PRIVATE_KEY) {
    const raw = process.env.GOOGLE_WALLET_PRIVATE_KEY.trim();
    return raw.includes("BEGIN PRIVATE KEY")
      ? { private_key: raw }
      : JSON.parse(raw);
  }
  const envPath = process.env.GOOGLE_WALLET_KEY_PATH;
  const candidates = [
    envPath && (path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath)),
    path.resolve(process.cwd(), "backend/keys/wallet-sa.json"),
    path.resolve(__dirname, "../../keys/wallet-sa.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log("[styleLikeMock] usando credenciales:", p);
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
  throw new Error("No se encontraron credenciales (GOOGLE_WALLET_PRIVATE_KEY o archivo JSON).");
}


// ---- Cuerpo de la Class según tier ----
function classBody(tier) {
  const isGold = tier === "gold";
  const classId = isGold ? classGold : classBlue;
  return {
    id: `${issuerId}.${classId}`,
    issuerName: "Distribuidora Alcazarén, S. A.",
    programName: "Lealtad Alcazaren",

    // 👇 OBLIGATORIO al crear una Class
    reviewStatus: "UNDER_REVIEW",        // valores válidos: UNDER_REVIEW | APPROVED | REJECTED

    hexBackgroundColor: isGold ? GOLD_BG : BLUE_BG,
    textModulesData: [
      {
        header: "Information",
        body: isGold
          ? "Vive la experiencia premium con un 15% menos. Tu lealtad eleva cada brindis. <i>Aplican restricciones.</i>."
          : "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo. <i>Aplican restricciones.</i>."
      }
    ],
    imageModulesData: [
      {
        mainImage: {
          sourceUri: { uri: BANNER_URI },
          contentDescription: { defaultValue: { language: "es", value: "Celebremos Juntos" } }
        }
      }
    ]
  };
}


// ---- Upsert (patch si existe; insert si no) ----
async function upsertClass(wallet, tier) {
  const resource = classBody(tier);
  const id = resource.id;
  try {
    await wallet.loyaltyclass.get({ resourceId: id });
    await wallet.loyaltyclass.patch({ resourceId: id, resource });
    console.log(`Patched class ${id}`);
  } catch (e) {
    const nf = e?.code === 404 || e?.response?.status === 404;
    if (nf) {
      await wallet.loyaltyclass.insert({ resource });
      console.log(`Inserted class ${id}`);
    } else {
      console.error("Error upserting class:", e?.response?.data || e);
      throw e;
    }
  }
}

// ---- Main ----
// backend/scripts/wallet/styleLikeMock.js (fragmento correcto)
(async () => {
  try {
    if (!issuerId || !classBlue || !classGold) {
      throw new Error("Faltan GOOGLE_WALLET_ISSUER_ID / _CLASS_ID_BLUE / _CLASS_ID_GOLD");
    }

    const keyJson = resolveKeyJson();                 // 👈 aquí se define
    console.log("[SA] usando:", keyJson.client_email); // 👈 ahora sí puedes imprimirlo

    const auth = new google.auth.GoogleAuth({
      credentials: keyJson,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
    const wallet = google.walletobjects({ version: "v1", auth: await auth.getClient() });

    await upsertClass(wallet, "gold");
    await upsertClass(wallet, "blue");
    console.log("✅ Listo: Clases GOLD & BLUE con look tipo mock.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e?.response?.data || e?.message || e);
    process.exit(1);
  }
})();

