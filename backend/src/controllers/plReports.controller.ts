import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as plReportService from "../services/plReport.service";
import { idSchema } from "../lib/validation";

const schema = z.object({ fundId: idSchema });

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = schema.parse(req.query);
    res.json(await plReportService.listPlReports(fundId));
  } catch (e) {
    next(e);
  }
}
