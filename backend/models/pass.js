// backend/models/Pass.js
module.exports = (sequelize, DataTypes) => {
  const Pass = sequelize.define(
    "Pass",
    {
      // 🔗 relación: cada pass puede pertenecer a un member
      member_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "members", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      title:        { type: DataTypes.STRING, allowNull: false },
      description:  { type: DataTypes.STRING, allowNull: false },
      type:         { type: DataTypes.STRING, allowNull: false },
      status:       { type: DataTypes.STRING, defaultValue: "active" },

      backgroundColor: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: "#007AFF",
        validate: { is: /^#[0-9A-Fa-f]{6}$/ },
      },
      textColor: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: "#FFFFFF",
        validate: { is: /^#[0-9A-Fa-f]{6}$/ },
      },

      fields: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "passes",
      timestamps: true,
      indexes: [{ fields: ["member_id"] }],
    }
  );

  // (opcional) normaliza colores por si llegan sin '#'
  Pass.beforeValidate((pass) => {
    for (const k of ["backgroundColor", "textColor"]) {
      let v = pass[k];
      if (!v) continue;
      v = String(v).trim().toUpperCase();
      if (!v.startsWith("#")) v = "#" + v;
      pass[k] = v.slice(0, 7);
    }
  });

  // Asociación
  Pass.associate = (models) => {
    Pass.belongsTo(models.Member, { foreignKey: "member_id", as: "member" });
  };

  return Pass;
};
