import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";

let loaded = false;

/** Local secrets live in backend/.env. Vercel injects the same keys into the process. */
export function loadBackendEnv(): void {
  if (loaded) return;
  loaded = true;
  const envFile = path.join(process.cwd(), "backend", ".env");
  if (fs.existsSync(envFile)) {
    loadEnv({ path: envFile });
  }
}
