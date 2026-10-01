import "dotenv/config";
import { createApp } from "./app";
import { getEnv } from "./config/env";
import { logger } from "./lib/logger";

const env = getEnv();
const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Tychi Allocator API listening on port ${env.PORT}`);
});
