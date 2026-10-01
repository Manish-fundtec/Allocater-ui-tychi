// From Tychi-2.0-backend-git/src/models/fund.model.js
const { DataTypes, UUIDV4 } = require("sequelize");
const sequelize = require("../../config/sequelize");

const Fund = sequelize.define(
  "Fund",
  {
    fund_id: {
      type: DataTypes.UUID,
      defaultValue: UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    fund_name: {
      type: DataTypes.BLOB,
      allowNull: true,
    },
    fund_description: {
      type: DataTypes.BLOB,
      allowNull: true,
    },
    fund_address: {
      type: DataTypes.BLOB,
      allowNull: true,
    },
    incorp_date: DataTypes.DATEONLY,
    reporting_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fy_ends_on: DataTypes.TEXT,
    reporting_frequency: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    reporting_currency: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    decimal_precision: DataTypes.INTEGER,
    fund_status: DataTypes.STRING,
    reporting_mtd: DataTypes.BOOLEAN,
    reporting_qtd: DataTypes.BOOLEAN,
    reporting_ytd: DataTypes.BOOLEAN,
    reporting_itd: DataTypes.BOOLEAN,
    commission_accounting_method: DataTypes.STRING,
    org_id: DataTypes.UUID,
    user_id: DataTypes.UUID,
    date_format: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    onboarding_mode: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "new fund",
    },
    multi_currency_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    fx_cost_method: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "FIFO",
      validate: { isIn: [["FIFO", "LIFO", "AVERAGE"]] },
    },
    pricing_delay_mode: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "DIRECT",
      validate: { isIn: [["DIRECT", "MANUAL_INTERVENTION"]] },
    },
    pricing_delay_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "funds",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = Fund;
