import winston from "winston";
import { getEnv } from "../config/env";

export const logger = winston.createLogger({
  level: getEnv().NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
