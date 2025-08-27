const express = require("express");
const router = express.Router();
const passController = require("../controllers/passController");

router.post("/", passController.createPass);
router.get("/", passController.getAllPasses); 
router.delete("/:id", passController.deletePass);
router.put("/:id/assign-member", passController.assignMember);


module.exports = router;
