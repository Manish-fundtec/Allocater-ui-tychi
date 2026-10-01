import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as reportsService from "../services/reports.service";
import * as investorAllocationReportService from "../services/investorAllocationReport.service";
import * as investorStatementService from "../services/investorStatement.service";
import * as investorRegisterService from "../services/investorRegister.service";
import { idSchema } from "../lib/validation";

const fundSchema = z.object({ fundId: idSchema });
const runIdSchema = z.object({ runId: idSchema });
const previewSchema = z.object({ runId: idSchema });

export async function unsent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = fundSchema.parse(req.query);
    res.json(await reportsService.listUnsent(fundId));
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
    const { fundId } = fundSchema.parse(req.query);
    res.json(await reportsService.listAll(fundId));
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
    const { runId } = previewSchema.parse(req.query);
    const html = await reportsService.previewHtml(
      String(req.params.investorId),
      runId,
    );
    res.type("html").send(html);
  } catch (e) {
    next(e);
  }
}

export async function sendOne(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { runId } = runIdSchema.parse(req.body);
    res.json(
      await reportsService.sendOne(String(req.params.investorId), runId),
    );
  } catch (e) {
    next(e);
  }
}

export async function sendAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { runId } = runIdSchema.parse(req.body);
    res.json(await reportsService.sendAll(runId));
  } catch (e) {
    next(e);
  }
}

const allocationReportSchema = z.object({
  fundId: idSchema,
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function investorAllocation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId, period } = allocationReportSchema.parse(req.query);
    res.json(
      await investorAllocationReportService.getInvestorAllocationReport(
        fundId,
        period,
      ),
    );
  } catch (e) {
    next(e);
  }
}

const statementSchema = z.object({
  fundId: idSchema,
  period: z.string().regex(/^\d{4}-\d{2}$/),
  investorId: idSchema.optional(),
});

export async function investorStatements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId, period, investorId } = statementSchema.parse(req.query);
    res.json(
      await investorStatementService.getInvestorStatements(
        fundId,
        period,
        investorId,
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function investorRegister(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fundId } = fundSchema.parse(req.query);
    res.json(await investorRegisterService.getInvestorRegister(fundId));
  } catch (e) {
    next(e);
  }
}
