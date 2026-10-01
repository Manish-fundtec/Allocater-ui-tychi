import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as allocationService from "../services/allocation.service";
import { idSchema } from "../lib/validation";

const historySchema = z.object({
  fundId: idSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const investorHistorySchema = z.object({
  investorId: idSchema,
});

const runBodySchema = z.object({
  fundId: idSchema,
  period: z.string().regex(/^\d{4}-\d{2}$/),
  investorIds: z.array(idSchema).min(1),
});

export async function getHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId, limit } = historySchema.parse(req.query);
    res.json(await allocationService.getAllocationHistory(fundId, limit));
  } catch (e) {
    next(e);
  }
}

export async function getInvestorHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { investorId } = investorHistorySchema.parse(req.query);
    res.json(await allocationService.getInvestorAllocationHistory(investorId));
  } catch (e) {
    next(e);
  }
}

export async function preview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = runBodySchema.parse(req.body);
    res.json(
      await allocationService.previewAllocation(
        body.fundId,
        body.period,
        body.investorIds,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function run(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = runBodySchema.parse(req.body);
    const result = await allocationService.runAllocation(
      body.fundId,
      body.period,
      body.investorIds,
      req.user!.id,
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}
