const express = require("express");
const router = express.Router();
const passController = require("../controllers/passController");
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.post("/", requireRole('admin'), passController.createPass);
router.get("/", passController.getAllPasses); 
router.get("/:id", passController.getPassById);
router.put("/:id", requireRole('admin'), passController.updatePass);
router.delete("/:id", requireRole('admin'), passController.deletePass);
router.put("/:id/assign-member", requireRole('admin'), passController.assignMember);


module.exports = router;
