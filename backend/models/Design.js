// backend/models/Design.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Design', {
    // id: AUTOINCREMENT por defecto
    tarjeta_id:     { type: DataTypes.INTEGER, allowNull: true },
    name:           { type: DataTypes.STRING(100), allowNull: true },
    title:          { type: DataTypes.STRING(100), allowNull: false },
    tier:           { type: DataTypes.STRING(30),  allowNull: false, defaultValue: 'base' },

    // usa SOLO un set de colores para evitar duplicados
    backgroundColor:{ type: DataTypes.STRING(7),  allowNull: false, defaultValue: '#0A4A76' },
    textColor:      { type: DataTypes.STRING(7),  allowNull: false, defaultValue: '#FFFFFF' },

    // si `data` es JSON en PostgreSQL, usa DataTypes.JSONB; si prefieres texto plano, cambia a STRING/TEXT
    data:           { type: DataTypes.JSONB, allowNull: false },
  }, {
    tableName: 'designs',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  });
};
