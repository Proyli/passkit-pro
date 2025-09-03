const express = require("express");
const router = express.Router();
//const controller = require("../controllers/authController");
const authController = require("../controllers/authController");

router.post("/login", controller.login);
router.post("/change-password", controller.changePassword);
router.post("/email/send-pass", authController.sendPassEmail);

module.exports = router;