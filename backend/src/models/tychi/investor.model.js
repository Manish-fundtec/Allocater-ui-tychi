// From Tychi-2.0-backend-git/src/models/investor.model.js (portal_investors)
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize");

const Investor = sequelize.define(
  "Investor",
  {
    investor_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    external_investor_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fund_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "funds", key: "fund_id" },
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    full_legal_name: DataTypes.STRING(255),
    mailing_address: DataTypes.TEXT,
    investor_type: DataTypes.STRING(50),
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    tableName: "portal_investors",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["fund_id"] },
      { fields: ["org_id"] },
      { fields: ["user_id"] },
      { fields: ["email"] },
      { unique: true, fields: ["email", "fund_id"] },
    ],
  },
);

module.exports = Investor;
