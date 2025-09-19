const path = require("path");
const fs = require("fs");
// Carga .env desde la raíz de backend, sin depender del cwd
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

// --- DEBUG opcional (puedes dejarlo mientras pruebas) ---
console.log("[set:rtn] cwd =", process.cwd());
console.log("[set:rtn] .env existe =", fs.existsSync(path.resolve(__dirname, "..", ".env")));
console.log("[set:rtn] GOOGLE_WALLET_KEY_PATH =", process.env.GOOGLE_WALLET_KEY_PATH);
// --------------------------------------------------------
