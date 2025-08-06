const express = require("express");
const router = express.Router();
const passController = require("../controllers/passController");

router.post("/", passController.createPass);
router.get("/", passController.getAllPasses); 

module.exports = router;
