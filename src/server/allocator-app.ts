import type { Express } from "express";
import { loadBackendEnv } from "@/server/load-backend-env";

let appPromise: Promise<Express> | null = null;

export function getAllocatorApp(): Promise<Express> {
  if (!appPromise) {
    loadBackendEnv();
    appPromise = import("../../backend/src/app")
      .then((mod) => mod.createApp())
      .catch((error: unknown) => {
        appPromise = null;
        throw error;
      });
  }
  return appPromise;
}
