const express = require("express");
const router = express.Router();
const controller = require("../controllers/memberController");
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.get("/", controller.getAllMembers);
router.post("/", requireRole('admin'), controller.createMember);
router.put("/:id", requireRole('admin'), controller.updateMember);
router.delete("/:id", requireRole('admin'), controller.deleteMember);

router.post("/assign-card", controller.assignCardToMember);

module.exports = router;
