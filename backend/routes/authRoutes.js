const express = require("express");
const router = express.Router();

// usa SIEMPRE el mismo controlador
const controller = require("../controllers/authController");
const { requireAuth, rateLimit } = require('../middleware/auth');
let enforceLoginSecurity;
try { enforceLoginSecurity = require('../middleware/loginSecurity').enforceLoginSecurity; } catch { enforceLoginSecurity = null; }

// Rate limit login to mitigate brute-force
const loginMiddlewares = [ rateLimit({ windowMs: 15*60*1000, max: 50 }) ];
if (process.env.RECAPTCHA_SECRET || process.env.LOGIN_IP_ALLOWLIST) {
  if (typeof enforceLoginSecurity === 'function') loginMiddlewares.push(enforceLoginSecurity);
}
router.post("/login", loginMiddlewares, controller.login);
router.post("/change-password", requireAuth, controller.changePassword);
router.post("/reset-password", controller.resetPassword);     // opcional, pero útil
router.post("/email/send-pass", controller.sendPassEmail);

module.exports = router;
