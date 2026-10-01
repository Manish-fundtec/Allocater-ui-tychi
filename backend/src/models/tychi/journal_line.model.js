// From Tychi-2.0-backend-git/src/models/journal_line.model.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize");
const Journal = require("./journal.model");

const JournalLine = sequelize.define(
  "JournalLine",
  {
    line_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    journal_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "journals",
        key: "journal_id",
      },
      onDelete: "CASCADE",
    },
    fund_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    gl_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "account_code",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    debit_amount: {
      type: DataTypes.DECIMAL(20, 10),
      allowNull: false,
      defaultValue: 0,
    },
    credit_amount: {
      type: DataTypes.DECIMAL(20, 10),
      allowNull: false,
      defaultValue: 0,
    },
    fx_rate: {
      type: DataTypes.DECIMAL(20, 10),
      allowNull: false,
      defaultValue: 1,
    },
    debit_amount_base: {
      type: DataTypes.DECIMAL(20, 10),
      allowNull: false,
      defaultValue: 0,
    },
    credit_amount_base: {
      type: DataTypes.DECIMAL(20, 10),
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    symbol_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    lot_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    broker_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    line_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: "line_number",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "journal_lines",
    timestamps: false,
  },
);

Journal.hasMany(JournalLine, { foreignKey: "journal_id", as: "lines" });
JournalLine.belongsTo(Journal, { foreignKey: "journal_id" });

module.exports = JournalLine;
