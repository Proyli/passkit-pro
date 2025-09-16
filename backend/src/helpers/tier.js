// backend/src/helpers/tier.js
function classIdForTier(tier = "blue") {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  const t = String(tier).trim().toLowerCase();

  // acepta "gold", "gold 15", "15%", etc.
  const isGold =
    t.includes("gold") || t.includes("15");

  const classShort = isGold
    ? process.env.GOOGLE_WALLET_CLASS_ID_GOLD   // p.ej. digital_pass_gold
    : process.env.GOOGLE_WALLET_CLASS_ID_BLUE;  // p.ej. digital_pass_blue

  if (!issuer || !classShort) {
    throw new Error("Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_CLASS_ID_[BLUE|GOLD]");
  }
  return `${issuer}.${classShort}`;
}

module.exports = { classIdForTier };
