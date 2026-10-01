// Mirrors Tychi-2.0-backend-git/src/config/db.js — uses DB_* from .env
const { Sequelize } = require("sequelize");

const host = process.env.DB_HOST || "localhost";
const useSsl =
  process.env.DB_SSL === "true" || host.includes("rds.amazonaws.com");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host,
    port: Number(process.env.DB_PORT || 5432),
    dialect: "postgres",
    logging: process.env.SEQUELIZE_LOGGING === "true" ? console.log : false,
    dialectOptions: useSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  },
);

module.exports = sequelize;
