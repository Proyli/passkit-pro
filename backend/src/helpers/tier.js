// backend/src/helpers/tier.js  (CommonJS)
function classIdForTier(tier) {
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
  const base   = process.env.GOOGLE_WALLET_CLASS_ID;
  return `${issuer}.${base}-${tier}`; // ej: 3388...digital_pass_demo_2-blue
}
module.exports = { classIdForTier };
