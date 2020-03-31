const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Alliance = sequelize.define('alliance', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      code: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
      },
      points: {
        type: DataTypes.BIGINT.UNSIGNED,
        defaultValue: 0,
      },
      islands: {
        type: DataTypes.BIGINT.UNSIGNED,
        defaultValue: 0,
      },
    },
  );

  Alliance.associate = (models) => {
    Alliance.hasMany(models.player);
    Alliance.belongsTo(models.world, {
      onDelete: 'CASCADE',
      foreignKey: {
        allowNull: false,
      },
    });
    Alliance.hasMany(models.allianceChange, { as: 'oldAlly', foreignKey: 'oldAllyId' });
    Alliance.hasMany(models.allianceChange, { as: 'newAlly', foreignKey: 'newAllyId' });
    Alliance.hasMany(models.alliancePointsIncrease);
  };

  return Alliance;
};