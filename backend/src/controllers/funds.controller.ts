import type { Request, Response, NextFunction } from "express";
import * as fundModel from "../models/fund.model";

export async function listFunds(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rows = await fundModel.listFunds();
    res.json(rows);
  } catch (e) {
    next(e);
  }
}
