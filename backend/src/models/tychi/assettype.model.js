// From Tychi-2.0-backend-git/src/models/assettype.model.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize");

const AssetType = sequelize.define(
  "AssetType",
  {
    assettype_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fund_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    long_term_rule: {
      type: DataTypes.TEXT,
    },
    closure_rule: {
      type: DataTypes.TEXT,
    },
    default_settle_cycle: {
      type: DataTypes.INTEGER,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "Inactive",
    },
    "4060_rule": {
      type: DataTypes.TEXT,
      defaultValue: "no",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "assettype",
    timestamps: false,
  },
);

module.exports = AssetType;
