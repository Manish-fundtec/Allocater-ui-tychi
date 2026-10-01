import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../lib/errors";
import * as settingsService from "../services/settings.service";

const patchSchema = z.object({
  section: z.enum(["email", "tychi"]),
  values: z.record(z.string(), z.string()),
});

const putSchema = z.object({ action: z.enum(["test-email"]) });

export async function get(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await settingsService.getSettings());
  } catch (e) {
    next(e);
  }
}

export async function post(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = patchSchema.parse(req.body);
    res.json(await settingsService.saveSettings(body.section, body.values));
  } catch (e) {
    next(e);
  }
}

export async function put(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { action } = putSchema.parse(req.body);
    if (action === "test-email") {
      res.json(
        await settingsService.testEmail(req.user!.email),
      );
      return;
    }
    throw new ApiError("Unknown action", 400);
  } catch (e) {
    next(e);
  }
}
