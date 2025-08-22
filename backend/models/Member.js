module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Member", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    external_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    nombre: DataTypes.STRING,
    apellido: DataTypes.STRING,
    fechaNacimiento: DataTypes.STRING,
    codigoCliente: DataTypes.STRING,
    codigoCampana: DataTypes.STRING,
    tipoCliente: DataTypes.STRING,
    email: DataTypes.STRING,
    telefono: DataTypes.STRING,
    puntos: DataTypes.INTEGER,
    genero: DataTypes.STRING,
    // ❌ elimina fechaCreacion y fechaExpiracion
  }, {
    tableName: 'members',
    timestamps: true, // ✅ Activa los timestamps automáticos
  });
};
