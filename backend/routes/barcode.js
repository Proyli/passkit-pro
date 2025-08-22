// routes/barcode.js
const express = require("express");
const bwipjs = require("bwip-js");

const router = express.Router();

// GET /api/barcode/<valor>.png  (ej: /api/barcode/PK%7CL05608%7CC0078.png)
router.get("/barcode/:value.png", async (req, res) => {
  try {
    const value = String(req.params.value || "");
    if (!value) return res.status(400).send("missing value");

    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: value,
      scale: 4,
      height: 12,
      includetext: true,
      textxalign: "center",
    });

    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("png").send(png);
  } catch (e) {
    res.status(500).send("barcode error");
  }
});

module.exports = router;
