import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as tychiService from "../services/tychi.service";
import { idSchema } from "../lib/validation";

const fetchSchema = z.object({
  fundId: idSchema,
  periodFrom: z.string().regex(/^\d{4}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}$/),
});

const historySchema = z.object({ fundId: idSchema });

export async function fetchPl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = fetchSchema.parse(req.body);
    res.json(
      await tychiService.fetchPlRange(
        body.fundId,
        body.periodFrom,
        body.periodTo,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function importHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = historySchema.parse(req.query);
    res.json(await tychiService.getImportHistory(fundId));
  } catch (e) {
    next(e);
  }
}

export async function testConnection(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await tychiService.testConnection());
  } catch (e) {
    next(e);
  }
}
