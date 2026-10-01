import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError, AuthError } from "../lib/errors";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";

function isDbConnectionError(err: unknown): boolean {
  const codes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND"]);
  const check = (e: { code?: string } | undefined) =>
    e?.code != null && codes.has(e.code);
  if (check(err as { code?: string })) return true;
  if (err instanceof AggregateError) {
    return err.errors.some((e) => check(e as { code?: string }));
  }
  return false;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AuthError) {
    res.status(401).json({ error: err.message });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.errors.map((e) => e.message).join("; ") });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  if (/connection timeout|Connection terminated/i.test(message)) {
    res.status(503).json({
      error:
        "The database did not accept a connection from Vercel. Allow port 5432 from Vercel to the RDS instance, or use a database host Vercel can reach.",
    });
    return;
  }

  if (isDbConnectionError(err)) {
    logger.error("Database connection failed", {
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(503).json({
      error:
        "Cannot connect to PostgreSQL. On Vercel, set DATABASE_URL to the remote database, not localhost.",
    });
    return;
  }

  if (getEnv().NODE_ENV === "development" && err instanceof Error) {
    logger.error(message, { stack: err.stack });
  } else {
    logger.error(message);
  }
  res.status(500).json({ error: message });
}
