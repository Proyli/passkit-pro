// backend/src/helpers/tier.js
function ensurePrefixed(id) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!id) return null;
  // si ya viene con issuer (3388....*), respétalo
  return /^\d+\./.test(id) ? id : `${issuer}.${id}`;
}

function classIdForTier(tier = "") {
  const t = String(tier).trim().toLowerCase();
  const isGold = t.includes("gold"); // aquí ya te llega "gold" o "blue"

  // Buscar múltiples nombres de variable de entorno para ser tolerante
  const goldShort =
    process.env.GW_CLASS_ID_GOLD ||
    process.env.GOOGLE_WALLET_CLASS_ID_GOLD ||
    process.env.GOOGLE_WALLET_CLASS_ID ||
    process.env.GW_CLASS_ID ||
    null;
  const blueShort =
    process.env.GW_CLASS_ID_BLUE ||
    process.env.GOOGLE_WALLET_CLASS_ID_BLUE ||
    process.env.GOOGLE_WALLET_CLASS_ID ||
    process.env.GW_CLASS_ID ||
    null;

  const chosen = isGold ? goldShort : blueShort;
  const full = ensurePrefixed(chosen);

  if (!full) {
    console.error("[tier] classIdForTier missing envs:", { isGold, goldShort, blueShort });
    throw new Error("Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_CLASS_ID_[BLUE|GOLD]");
  }
  return full;
}

module.exports = { classIdForTier };
