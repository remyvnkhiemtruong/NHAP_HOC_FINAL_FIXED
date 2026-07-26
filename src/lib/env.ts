import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  STORAGE_ROOT: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  RATE_LIMIT_BACKEND: z.enum(["redis", "memory"]).default("redis"),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(1),
});

export type RuntimeEnv = z.infer<typeof baseEnvSchema>;

let cached: RuntimeEnv | undefined;

export function runtimeEnv(): RuntimeEnv {
  if (cached) return cached;
  const input = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      (process.env.NODE_ENV === "test" ? "postgresql://test:test@localhost:5432/test" : undefined),
    JWT_SECRET: process.env.JWT_SECRET ?? (process.env.NODE_ENV === "test" ? "test-jwt-secret-test-jwt-secret-1234" : undefined),
    ENCRYPTION_KEY:
      process.env.ENCRYPTION_KEY ??
      (process.env.NODE_ENV === "test"
        ? "4f5a7e8d1c2b3a49687766554433221100112233445566778899aabbccddeeff"
        : undefined),
    STORAGE_ROOT: process.env.STORAGE_ROOT ?? (process.env.NODE_ENV === "test" ? ".test-storage" : undefined),
  };
  const parsed = baseEnvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid runtime configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  if (
    parsed.data.NODE_ENV === "production" &&
    (parsed.data.RATE_LIMIT_BACKEND !== "redis" || !parsed.data.REDIS_URL)
  ) {
    throw new Error("Production requires REDIS_URL and RATE_LIMIT_BACKEND=redis");
  }
  cached = parsed.data;
  return cached;
}

export function resetRuntimeEnvForTests(): void {
  if (process.env.NODE_ENV === "test") cached = undefined;
}
