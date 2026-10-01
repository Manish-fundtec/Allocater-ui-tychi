import { z } from "zod";

function databaseUrlFromParts(env: NodeJS.ProcessEnv): string | undefined {
  const host = env.DB_HOST?.trim();
  const user = env.DB_USER?.trim();
  const name = env.DB_NAME?.trim();
  if (!host || !user || !name) return undefined;
  const port = env.DB_PORT?.trim() || "5432";
  const password = encodeURIComponent(env.DB_PASSWORD ?? "");
  const sslmode = env.DB_SSL === "false" ? "disable" : "require";
  return `postgresql://${encodeURIComponent(user)}:${password}@${host}:${port}/${encodeURIComponent(name)}?sslmode=${sslmode}`;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // Auth is still a stub (any bearer/cookie is accepted). Unset means the
  // dashboard can load. Set DEV_AUTH_BYPASS=false once a real session exists.
  DEV_AUTH_BYPASS: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
  TYCHI_API_BASE_URL: z.string().optional(),
  TYCHI_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("noreply@fundtec.io"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .default("change-me-in-production-32chars!!"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    if (!process.env.DATABASE_URL?.trim()) {
      const built = databaseUrlFromParts(process.env);
      if (built) process.env.DATABASE_URL = built;
    }
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        "Database is not configured. In Vercel set DATABASE_URL, or set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME, then redeploy.",
      );
    }
    cached = parsed.data;
  }
  return cached;
}
