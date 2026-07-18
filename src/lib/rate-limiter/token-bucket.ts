// ==============================================
// RateFlow — Token Bucket Rate Limiter (Redis-backed)
// Uses atomic Lua scripts for distributed rate limiting
// ==============================================

import type Redis from "ioredis";
import { TOKEN_BUCKET_SCRIPT } from "./lua-scripts";
import { REDIS_KEY_PREFIX } from "../constants";
import type { RateLimitResult } from "@/types";

/**
 * Redis-backed Token Bucket rate limiter.
 *
 * Uses a Lua script to atomically check and consume tokens,
 * making it safe for use across multiple application instances
 * sharing the same Redis server.
 */
export class TokenBucketLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Checks whether a request should be allowed for the given client.
   *
   * @param clientId - Unique identifier of the client
   * @param maxTokens - Maximum tokens (requests) allowed per window
   * @param windowSeconds - Duration of the rate limit window in seconds
   * @returns Rate limit result with allowed status, remaining tokens, and retry-after
   */
  async check(
    clientId: string,
    maxTokens: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `${REDIS_KEY_PREFIX}${clientId}`;
    const now = Date.now() / 1000; // Current time in seconds (float precision)

    // Execute the Lua script atomically in Redis
    const result = (await this.redis.eval(
      TOKEN_BUCKET_SCRIPT,
      1, // Number of KEYS
      key, // KEYS[1]
      maxTokens.toString(), // ARGV[1]
      windowSeconds.toString(), // ARGV[2]
      now.toString() // ARGV[3]
    )) as [number, number, number];

    const [allowed, remaining, retryAfter] = result;

    return {
      allowed: allowed === 1,
      remaining: Math.max(0, remaining),
      retryAfter: allowed === 1 ? 0 : Math.max(1, retryAfter),
    };
  }

  /**
   * Resets the token bucket for a specific client.
   * Useful for admin operations or testing.
   */
  async reset(clientId: string): Promise<void> {
    const key = `${REDIS_KEY_PREFIX}${clientId}`;
    await this.redis.del(key);
  }
}
