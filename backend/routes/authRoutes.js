const express = require("express");
const router = express.Router();

// usa SIEMPRE el mismo controlador
const controller = require("../controllers/authController");

router.post("/login", controller.login);
router.post("/change-password", controller.changePassword);
router.post("/reset-password", controller.resetPassword);     // opcional, pero útil
router.post("/email/send-pass", controller.sendPassEmail);

module.exports = router;
