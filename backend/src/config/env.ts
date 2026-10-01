import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DEV_AUTH_BYPASS: z
    .string()
    .optional()
    .transform((v) => v === "true"),
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
    cached = envSchema.parse(process.env);
  }
  return cached;
}
