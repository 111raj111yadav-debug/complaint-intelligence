import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root or local .env
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config(); // fallback to local cwd

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1000).max(65535))
    .default("5000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NLP_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  NLP_TIMEOUT_SECONDS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default("10"),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000"),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters long")
    .default("phase3_complaint_intelligence_jwt_secret_dev_2026_xyz"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default("900000"), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default("100"),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default("20"),
}).refine(
  (data) => {
    if (data.NODE_ENV === "production") {
      if (data.JWT_SECRET === "phase3_complaint_intelligence_jwt_secret_dev_2026_xyz") {
        return false;
      }
      if (data.JWT_SECRET.length < 32) {
        return false;
      }
    }
    return true;
  },
  {
    message:
      "In production mode, JWT_SECRET must not use the default development secret and must be at least 32 characters long.",
    path: ["JWT_SECRET"],
  },
).refine(
  (data) => {
    if (data.NODE_ENV === "production") {
      const lower = data.DATABASE_URL.toLowerCase();
      if (
        lower.includes("postgres:2004@") ||
        lower.includes("complaint_secure_dev_pass_2026") ||
        lower.includes("localhost:5434") ||
        lower.includes("127.0.0.1:5434")
      ) {
        return false;
      }
    }
    return true;
  },
  {
    message:
      "In production mode, DATABASE_URL must not use local development credentials or default development passwords.",
    path: ["DATABASE_URL"],
  },
);

export type EnvConfig = z.infer<typeof envSchema>;

let validatedEnv: EnvConfig;

export function getEnv(): EnvConfig {
  if (!validatedEnv) {
    const parseResult = envSchema.safeParse(process.env);
    if (!parseResult.success) {
      console.error("❌ Environment validation failed:");
      console.error(JSON.stringify(parseResult.error.format(), null, 2));
      throw new Error(
        `Environment validation failed: ${parseResult.error.message}`,
      );
    }
    validatedEnv = parseResult.data;
  }
  return validatedEnv;
}

export const env = getEnv();
