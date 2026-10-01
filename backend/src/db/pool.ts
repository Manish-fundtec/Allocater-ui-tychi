import { Pool, type QueryResultRow } from "pg";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";

let pool: Pool | null = null;

function poolSsl(
  connectionString: string,
): false | { rejectUnauthorized: false } {
  if (process.env.DB_SSL === "false") return false;
  let host = "localhost";
  let sslmode = "";
  try {
    const url = new URL(connectionString);
    host = url.hostname;
    sslmode = url.searchParams.get("sslmode") ?? "";
  } catch {
    host = "localhost";
  }
  if (sslmode === "disable") return false;
  const local = host === "localhost" || host === "127.0.0.1";
  const remote =
    process.env.DB_SSL === "true" ||
    sslmode === "require" ||
    host.includes("rds.amazonaws.com") ||
    !local;
  return remote ? { rejectUnauthorized: false } : false;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getEnv().DATABASE_URL;
    pool = new Pool({
      connectionString,
      ssl: poolSsl(connectionString),
      max: process.env.NODE_ENV === "production" ? 1 : 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // Idle clients can error when Postgres restarts; must not crash the process.
    pool.on("error", (err) => {
      logger.error("PostgreSQL pool idle client error", {
        message: err.message,
        stack: err.stack,
      });
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
