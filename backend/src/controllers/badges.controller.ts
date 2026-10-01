import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as badgesService from "../services/badges.service";
import { idSchema } from "../lib/validation";

const schema = z.object({ fundId: idSchema });

export async function getBadges(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = schema.parse(req.query);
    res.json(await badgesService.getBadges(fundId));
  } catch (e) {
    next(e);
  }
}
