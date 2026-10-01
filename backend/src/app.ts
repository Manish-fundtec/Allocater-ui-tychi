import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { getEnv } from "./config/env";
import apiRoutes from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const env = getEnv();
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: [env.CORS_ORIGIN, "http://localhost:3000"],
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", apiRoutes);
  app.use(errorHandler);

  return app;
}
