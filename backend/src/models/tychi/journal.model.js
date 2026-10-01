// From Tychi-2.0-backend-git/src/models/journal.model.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize");

const Journal = sequelize.define(
  "Journal",
  {
    journal_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    fund_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    journal_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    journal_type: {
      type: DataTypes.STRING(50),
    },
    document_number: {
      type: DataTypes.STRING(100),
    },
    description: {
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "posted",
    },
    source: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PIPELINE",
    },
    reversal_of: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    base_currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    native_currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    base_amount: {
      type: DataTypes.DECIMAL(20, 10),
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
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
    tableName: "journals",
    timestamps: false,
  },
);

module.exports = Journal;
