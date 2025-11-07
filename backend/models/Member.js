// backend/models/Member.js
module.exports = (sequelize, DataTypes) => {
  const Member = sequelize.define(
    "Member",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      external_id: { type: DataTypes.STRING, allowNull: false, unique: true },
      nombre: DataTypes.STRING,
      apellido: DataTypes.STRING,
      fechaNacimiento: DataTypes.STRING,
      codigoCliente: DataTypes.STRING,
      codigoCampana: DataTypes.STRING,
      tipoCliente: DataTypes.STRING,
      // Credenciales básicas para login
      password: DataTypes.STRING,
      role: DataTypes.STRING,
      email: DataTypes.STRING,
      telefono: DataTypes.STRING,
      puntos: DataTypes.INTEGER,
      genero: DataTypes.STRING,
    },
    {
      tableName: "members",
      timestamps: true,
    }
  );

  // Asociación
  Member.associate = (models) => {
    Member.hasMany(models.Pass, { foreignKey: "member_id", as: "passes" });
  };

  return Member;
};
