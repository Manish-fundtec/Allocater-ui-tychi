import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as investorService from "../services/investor.service";
import { idSchema } from "../lib/validation";

const listSchema = z.object({
  fundId: idSchema,
  status: z.enum(["all", "active", "exited"]).optional().default("all"),
  search: z.string().optional().default(""),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const patchSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = listSchema.parse(req.query);
    res.json(
      await investorService.listInvestors(
        q.fundId,
        q.status,
        q.search,
        q.period,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await investorService.getInvestor(String(req.params.id)));
  } catch (e) {
    next(e);
  }
}

export async function patch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = patchSchema.parse(req.body);
    res.json(
      await investorService.patchInvestor(
        String(req.params.id),
        body.email,
        body.phone,
      ),
    );
  } catch (e) {
    next(e);
  }
}
