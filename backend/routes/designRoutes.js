// backend/routes/designRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/designController");

router.post("/", ctrl.create);      // crear
router.get("/", ctrl.list);         // listar
router.get("/:id", ctrl.get);       // obtener uno
router.put("/:id", ctrl.update);    // actualizar
router.delete("/:id", ctrl.remove); // eliminar

module.exports = router;
