const db = require("../models");
const Pass = db.Pass;
console.log("Modelo Pass:", Pass);

exports.createPass = async (req, res) => {
  try {
    const newPass = await Pass.create(req.body);
    res.status(201).json(newPass);
  } catch (error) {
    console.error("Error creating pass:", error);
    res.status(500).json({ error: "Error creating pass" });
  }
};

exports.getAllPasses = async (req, res) => {
  try {
    const passes = await Pass.findAll();
    res.status(200).json(passes);
  } catch (error) {
    console.error("Error al obtener los pases:", error);
    res.status(500).json({ error: "Error al obtener los pases" });
  }
};
