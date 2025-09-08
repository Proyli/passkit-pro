// backend/src/helpers/tier.js
function classIdForTier(tier) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  const t = String(tier || "").toLowerCase();
  const short =
    t === "gold"
      ? process.env.GOOGLE_WALLET_CLASS_ID_GOLD
      : process.env.GOOGLE_WALLET_CLASS_ID_BLUE; // default blue

  if (!issuer || !short) {
    throw new Error("Faltan GOOGLE_WALLET_ISSUER_ID o GOOGLE_WALLET_CLASS_ID_[BLUE|GOLD]");
  }
  return `${issuer}.${short}`;
}
module.exports = { classIdForTier };
