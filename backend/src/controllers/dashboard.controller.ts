import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as dashboardService from "../services/dashboard.service";
import { idSchema } from "../lib/validation";

const schema = z.object({ fundId: idSchema });

export async function getStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = schema.parse(req.query);
    res.json(await dashboardService.getDashboardStats(fundId));
  } catch (e) {
    next(e);
  }
}
