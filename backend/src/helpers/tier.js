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

  const goldShort = process.env.GOOGLE_WALLET_CLASS_ID_GOLD || process.env.GOOGLE_WALLET_CLASS_ID;
  const blueShort = process.env.GOOGLE_WALLET_CLASS_ID_BLUE || process.env.GOOGLE_WALLET_CLASS_ID;

  const chosen = isGold ? goldShort : blueShort;
  const full   = ensurePrefixed(chosen);

  if (!full) {
    throw new Error("Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_CLASS_ID_[BLUE|GOLD]");
  }
  return full;
}

module.exports = { classIdForTier };
