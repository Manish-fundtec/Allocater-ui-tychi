import { createRequire } from "module";
import path from "path";

type PlSnapshotModule = {
  computePnLTotals: (
    fundId: string,
    endDate: string,
  ) => Promise<{
    net_profit: number;
    gross_revenue: number;
    total_expenses: number;
    rows: unknown[];
    range: Record<string, string>;
  }>;
  upsertPlReportSnapshot: (params: {
    fund_id: string;
    end_date: string;
    period_name?: string;
  }) => Promise<{ period: string; net_profit: number }>;
};

let cached: PlSnapshotModule | null = null;

/** Tychi Sequelize reads DB_* / DB_SSL — sync from allocator env before require(). */
function ensureTychiDbEnv(): void {
  const url = process.env.DATABASE_URL;
  if (url && !process.env.DB_HOST) {
    try {
      const parsed = new URL(url);
      process.env.DB_HOST = parsed.hostname;
      process.env.DB_PORT = parsed.port || "5432";
      process.env.DB_USER = decodeURIComponent(parsed.username);
      process.env.DB_PASSWORD = decodeURIComponent(parsed.password);
      process.env.DB_NAME = parsed.pathname.replace(/^\//, "");
    } catch {
      /* keep existing DB_* */
    }
  }

  if (process.env.DB_SSL === undefined) {
    const host = (process.env.DB_HOST || "localhost").toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    process.env.DB_SSL = isLocal ? "false" : "true";
  }
}

function tychiBackendRoot(): string {
  if (process.env.TYCHI_BACKEND_ROOT) {
    return path.resolve(process.cwd(), process.env.TYCHI_BACKEND_ROOT);
  }
  return path.resolve(process.cwd(), "..", "..", "Tychi-2.0-backend-git");
}

export function loadPlSnapshotModule(): PlSnapshotModule {
  if (cached) return cached;
  ensureTychiDbEnv();
  const root = tychiBackendRoot();
  const req = createRequire(path.join(root, "package.json"));
  cached = req(
    "./src/api/v1/allocator/plReportSnapshot.service.js",
  ) as PlSnapshotModule;
  return cached;
}
