import type { Request, Response, NextFunction } from "express";
import { getEnv } from "../config/env";
import { AuthError } from "../lib/errors";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const MOCK_USER: SessionUser = {
  id: "user-1",
  name: "Rahul A.",
  email: "rahul@fundtec.example",
  role: "Fund Manager",
};

/**
 * FundTec integration: verify JWT from Authorization header or fundtec_session cookie.
 * Production: replace with real JWT verify / session store lookup.
 */
export function getSessionUser(req: Request): SessionUser | null {
  const env = getEnv();
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    if (token) return MOCK_USER;
  }

  const cookie = req.cookies?.fundtec_session;
  if (cookie) return MOCK_USER;

  if (env.DEV_AUTH_BYPASS) {
    return MOCK_USER;
  }

  return null;
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const user = getSessionUser(req);
  if (!user) {
    next(new AuthError());
    return;
  }
  req.user = user;
  next();
}
