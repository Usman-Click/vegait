// ==============================================
// RateFlow — Redis Client
// ioredis singleton with health checking and reconnection
// ==============================================

import Redis from "ioredis";

/**
 * Global singleton pattern for Redis, same approach as Prisma.
 * Prevents multiple connections during Next.js hot-reload.
 */

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

/**
 * Creates a configured Redis instance with retry and error handling.
 * Silently handles connection failures so the app can fall back
 * to in-memory rate limiting.
 */
function createRedisClient(): Redis {
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // Exponential backoff: 200ms, 400ms, 800ms, then cap at 3s
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
    // Don't throw on connection errors — we handle failover gracefully
    enableOfflineQueue: false,
  });

  redis.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  redis.on("connect", () => {
    console.log("[Redis] Connected successfully");
  });

  redis.on("reconnecting", () => {
    console.log("[Redis] Reconnecting...");
  });

  return redis;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Quick health check: sends a PING command and checks for PONG.
 * Returns latency in milliseconds, or throws on failure.
 */
export async function checkRedisHealth(): Promise<number> {
  const start = Date.now();
  const result = await redis.ping();
  if (result !== "PONG") {
    throw new Error(`Unexpected PING response: ${result}`);
  }
  return Date.now() - start;
}
