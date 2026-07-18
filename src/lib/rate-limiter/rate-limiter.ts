// ==============================================
// RateFlow — Unified Rate Limiter
// Facade that handles Redis → in-memory failover automatically
// ==============================================

import type Redis from "ioredis";
import { TokenBucketLimiter } from "./token-bucket";
import { InMemoryLimiter } from "./in-memory-limiter";
import type { RateLimitResult } from "@/types";

/**
 * Unified Rate Limiter with automatic failover.
 *
 * Tries Redis-backed token bucket first. If Redis is unavailable
 * (connection error, timeout, etc.), automatically falls back to
 * the in-memory limiter and sets degraded mode.
 *
 * The /api/health endpoint reads `isDegraded()` to report the
 * current limiter mode to operators.
 */
export class RateLimiter {
  private rediLimiter: TokenBucketLimiter;
  private memoryLimiter: InMemoryLimiter;
  private degraded: boolean = false;

  constructor(redis: Redis) {
    this.rediLimiter = new TokenBucketLimiter(redis);
    this.memoryLimiter = new InMemoryLimiter();
  }

  /**
   * Checks rate limit for a client request.
   * Tries Redis first, falls back to in-memory on failure.
   */
  async check(
    clientId: string,
    maxTokens: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      const result = await this.rediLimiter.check(
        clientId,
        maxTokens,
        windowSeconds
      );
      // If we were degraded but Redis is back, clear the flag
      if (this.degraded) {
        console.log("[RateLimiter] Redis recovered — switching back from in-memory fallback");
        this.degraded = false;
      }
      return result;
    } catch (error) {
      // Redis is unavailable — switch to in-memory fallback
      if (!this.degraded) {
        console.warn(
          "[RateLimiter] Redis unavailable — switching to in-memory fallback:",
          error instanceof Error ? error.message : error
        );
        this.degraded = true;
      }
      return this.memoryLimiter.check(clientId, maxTokens, windowSeconds);
    }
  }

  /**
   * Resets the rate limit state for a client.
   * Resets both Redis and in-memory to ensure clean state.
   */
  async reset(clientId: string): Promise<void> {
    this.memoryLimiter.reset(clientId);
    try {
      await this.rediLimiter.reset(clientId);
    } catch {
      // Ignore Redis errors during reset
    }
  }

  /** Whether the limiter is currently running in degraded (in-memory) mode */
  isDegraded(): boolean {
    return this.degraded;
  }

  /** Returns the current operating mode */
  getMode(): "redis" | "in-memory" {
    return this.degraded ? "in-memory" : "redis";
  }

  /** Gracefully shuts down the in-memory limiter's cleanup timer */
  destroy(): void {
    this.memoryLimiter.destroy();
  }
}

// ---- Singleton instance ----

import { redis } from "../redis";

const globalForLimiter = globalThis as unknown as {
  rateLimiter: RateLimiter | undefined;
};

export const rateLimiter =
  globalForLimiter.rateLimiter ?? new RateLimiter(redis);

if (process.env.NODE_ENV !== "production") {
  globalForLimiter.rateLimiter = rateLimiter;
}
