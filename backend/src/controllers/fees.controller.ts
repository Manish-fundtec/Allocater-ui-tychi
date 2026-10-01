import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as feeService from "../services/fee.service";
import { idSchema } from "../lib/validation";

const getSchema = z.object({ fundId: idSchema });

const postSchema = z.object({
  fundId: idSchema,
  mgmtFeePct: z.number().min(0).max(100),
  perfFeePct: z.number().min(0).max(100),
  hurdleRate: z.number().min(0).max(100),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  effectiveFrom: z.string(),
});

const reviewSchema = z.object({
  fundId: idSchema,
  period: z.string().regex(/^\d{4}-\d{2}$/),
  investorIds: z.array(idSchema).optional(),
});

export async function get(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = getSchema.parse(req.query);
    res.json(await feeService.getFees(fundId));
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
    const body = postSchema.parse(req.body);
    res.json(await feeService.createFee(body));
  } catch (e) {
    next(e);
  }
}

export async function review(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = reviewSchema.parse(req.body);
    res.json(
      await feeService.reviewFees(
        body.fundId,
        body.period,
        body.investorIds,
      ),
    );
  } catch (e) {
    next(e);
  }
}
