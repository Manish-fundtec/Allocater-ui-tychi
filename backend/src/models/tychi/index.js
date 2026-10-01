/**
 * Sequelize models aligned with Tychi-2.0-backend-git.
 * Use for read/write against the shared Tychi PostgreSQL schema.
 *
 *   const { Fund, Journal, JournalLine, AssetType, Investor } = require('./models/tychi');
 */
const sequelize = require("../../config/sequelize");
const Fund = require("./fund.model");
const Journal = require("./journal.model");
const JournalLine = require("./journal_line.model");
const AssetType = require("./assettype.model");
const Investor = require("./investor.model");

Fund.hasMany(AssetType, { foreignKey: "fund_id", as: "assetTypes" });
AssetType.belongsTo(Fund, { foreignKey: "fund_id" });

Fund.hasMany(Investor, { foreignKey: "fund_id", as: "investors" });
Investor.belongsTo(Fund, { foreignKey: "fund_id" });

Fund.hasMany(Journal, { foreignKey: "fund_id", as: "journals" });
Journal.belongsTo(Fund, { foreignKey: "fund_id" });

module.exports = {
  sequelize,
  Fund,
  Journal,
  JournalLine,
  AssetType,
  Investor,
};
