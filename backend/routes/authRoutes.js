const express = require("express");
const router = express.Router();

// usa SIEMPRE el mismo controlador
const controller = require("../controllers/authController");
const { requireAuth, rateLimit } = require('../middleware/auth');

// Rate limit login to mitigate brute-force
router.post("/login", rateLimit({ windowMs: 15*60*1000, max: 50 }), controller.login);
router.post("/change-password", requireAuth, controller.changePassword);
router.post("/reset-password", controller.resetPassword);     // opcional, pero útil
router.post("/email/send-pass", controller.sendPassEmail);

module.exports = router;
