import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "../lib/errors";

type Source = "body" | "query" | "params";

export function validate<T>(schema: ZodSchema<T>, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join("; ");
      next(new ApiError(msg || "Validation failed", 400));
      return;
    }
    (req as Request & { validated: T }).validated = parsed.data;
    next();
  };
}
