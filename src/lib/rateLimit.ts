import IORedis from "ioredis";
import { logger } from "@/lib/logger";

type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();
let redisClient: IORedis | null | undefined;
let redisConnectPromise: Promise<void> | null = null;

function getRedis(): IORedis | null {
  if (redisClient !== undefined) return redisClient;
  if (process.env.RATE_LIMIT_BACKEND === "memory" || process.env.NODE_ENV === "test") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Production cannot use the in-memory rate limiter");
    }
    redisClient = null;
    return null;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Production requires REDIS_URL for rate limiting");
    }
    redisClient = null;
    return null;
  }

  redisClient = new IORedis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
    retryStrategy: () => null,
  });
  redisClient.on("error", (error) => {
    logger.error("Rate-limit Redis error", { error });
  });
  return redisClient;
}

export async function ensureRedisConnected(redis: IORedis): Promise<void> {
  if (redis.status === "ready") return;
  if (redisConnectPromise) {
    await redisConnectPromise;
    return;
  }
  if (redis.status !== "wait" && redis.status !== "connecting") {
    throw new Error(`Redis rate-limit client is not connectable (${redis.status})`);
  }
  redisConnectPromise = redis
    .connect()
    .then(() => undefined)
    .finally(() => {
      redisConnectPromise = null;
    });
  await redisConnectPromise;
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: Math.max(limit - 1, 0), resetAt };
  }
  current.count += 1;
  if (memoryBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of memoryBuckets) {
      if (bucket.resetAt <= now) memoryBuckets.delete(bucketKey);
    }
  }
  return {
    success: current.count <= limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return memoryRateLimit(key, limit, windowMs);

  try {
    await ensureRedisConnected(redis);
    const transaction = redis.multi();
    transaction.incr(key);
    transaction.pttl(key);
    const result = await transaction.exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    let ttl = Number(result?.[1]?.[1] ?? -1);
    if (count === 1 || ttl < 0) {
      await redis.pexpire(key, windowMs);
      ttl = windowMs;
    }
    return {
      success: count <= limit,
      remaining: Math.max(limit - count, 0),
      resetAt: Date.now() + ttl,
    };
  } catch (error) {
    logger.error("Rate limit backend unavailable", { error });
    if (process.env.NODE_ENV === "production") {
      return { success: false, remaining: 0, resetAt: Date.now() + windowMs };
    }
    logger.warn("Using in-memory rate limit fallback outside production");
    return memoryRateLimit(key, limit, windowMs);
  }
}
