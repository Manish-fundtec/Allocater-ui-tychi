import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as navService from "../services/nav.service";
import { idSchema } from "../lib/validation";

const historySchema = z.object({
  investorId: idSchema,
  fundId: idSchema,
});

const allSchema = z.object({
  fundId: idSchema,
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/);

const seedEntrySchema = z.object({
  investorId: idSchema,
  transactionCharges: z.number().min(0).optional(),
});

const seedBodySchema = z.object({
  fundId: idSchema,
  period: periodSchema,
  navPerShare: z.number().positive(),
  entries: z.array(seedEntrySchema).min(1),
});

const legacySeedEntrySchema = z.object({
  investorId: idSchema,
  fundId: idSchema,
  period: periodSchema,
  closeNav: z.number().positive(),
  transactionCharges: z.number().min(0).optional(),
});

const carrySchema = z.object({
  fundId: idSchema,
  period: periodSchema,
});

const configGetSchema = z.object({ fundId: idSchema });

const configPatchSchema = z.object({
  fundId: idSchema,
  initialNav: z.number().positive(),
});

const seedPreviewSchema = z.object({
  fundId: idSchema,
  period: periodSchema,
  navPerShare: z.coerce.number().positive(),
});

export async function history(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = historySchema.parse(req.query);
    res.json(await navService.getNavHistory(q.investorId, q.fundId));
  } catch (e) {
    next(e);
  }
}

export async function all(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = allSchema.parse(req.query);
    res.json(await navService.getNavAll(q.fundId, q.period));
  } catch (e) {
    next(e);
  }
}

export async function seedPreview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = seedPreviewSchema.parse(req.query);
    res.json(
      await navService.getSeedPreview(q.fundId, q.period, q.navPerShare),
    );
  } catch (e) {
    next(e);
  }
}

export async function seed(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const json = req.body as Record<string, unknown>;

    if (json.navPerShare != null && json.fundId && json.period) {
      const body = seedBodySchema.parse(json);
      res.json(await navService.seedNav(body));
      return;
    }

    const entries = Array.isArray(json.entries)
      ? z.array(legacySeedEntrySchema).min(1).parse(json.entries)
      : [legacySeedEntrySchema.parse(json)];

    res.json(await navService.seedNavLegacy(entries));
  } catch (e) {
    next(e);
  }
}

export async function carryForward(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = carrySchema.parse(req.body);
    res.json(await navService.carryForward(body.fundId, body.period));
  } catch (e) {
    next(e);
  }
}

export async function openPeriod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = carrySchema.parse(req.body);
    res.json(await navService.openPeriod(body.fundId, body.period));
  } catch (e) {
    next(e);
  }
}

export async function config(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = configGetSchema.parse(req.query);
    res.json(await navService.getNavConfig(fundId));
  } catch (e) {
    next(e);
  }
}

export async function updateConfig(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = configPatchSchema.parse(req.body);
    res.json(await navService.updateNavConfig(body.fundId, body.initialNav));
  } catch (e) {
    next(e);
  }
}
