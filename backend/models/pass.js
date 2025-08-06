module.exports = (sequelize, DataTypes) => {
  const Pass = sequelize.define("Pass", {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    type: {
      type: DataTypes.ENUM("coupon", "loyalty", "event"),
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("active", "inactive", "expired"),
      defaultValue: "active",
    },
  });

  return Pass;
};
