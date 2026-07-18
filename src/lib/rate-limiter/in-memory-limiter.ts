// ==============================================
// RateFlow — In-Memory Rate Limiter (Failsafe)
// Fallback when Redis is unavailable
// ==============================================

import type { RateLimitResult } from "@/types";

/** Internal state for a single client's token bucket */
interface BucketState {
  tokens: number;
  lastRefill: number; // Timestamp in seconds
  maxTokens: number;
  windowSeconds: number;
}

/**
 * In-memory token bucket rate limiter.
 *
 * Used as a failsafe when Redis becomes unavailable.
 * This keeps the service running (in degraded mode) instead
 * of blocking all traffic.
 *
 * Limitations vs Redis-backed limiter:
 * - Not shared across multiple instances (each instance has its own state)
 * - State is lost on process restart
 * - Higher memory usage under heavy load
 *
 * A periodic cleanup runs every 60 seconds to evict stale buckets.
 */
export class InMemoryLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Clean up stale buckets every 60 seconds to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Checks whether a request should be allowed for the given client.
   * Same interface as TokenBucketLimiter for seamless failover.
   */
  check(
    clientId: string,
    maxTokens: number,
    windowSeconds: number
  ): RateLimitResult {
    const now = Date.now() / 1000;
    const refillRate = maxTokens / windowSeconds;

    let bucket = this.buckets.get(clientId);

    // Initialize bucket if it doesn't exist
    if (!bucket) {
      bucket = {
        tokens: maxTokens,
        lastRefill: now,
        maxTokens,
        windowSeconds,
      };
      this.buckets.set(clientId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const newTokens = elapsed * refillRate;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + newTokens);
    bucket.lastRefill = now;

    // Update config in case it changed
    bucket.maxTokens = maxTokens;
    bucket.windowSeconds = windowSeconds;

    if (bucket.tokens >= 1) {
      // Consume one token
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfter: 0,
      };
    }

    // Calculate retry-after
    const retryAfter = (1 - bucket.tokens) / refillRate;
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil(retryAfter)),
    };
  }

  /**
   * Resets the token bucket for a specific client.
   */
  reset(clientId: string): void {
    this.buckets.delete(clientId);
  }

  /**
   * Removes buckets that haven't been accessed in over 2x their window.
   * Prevents unbounded memory growth under high cardinality.
   */
  private cleanup(): void {
    const now = Date.now() / 1000;
    for (const [key, bucket] of this.buckets) {
      const staleThreshold = bucket.windowSeconds * 2;
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(key);
      }
    }
  }

  /** Gracefully shuts down the cleanup timer */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
  }

  /** Returns the number of active buckets (for monitoring) */
  get size(): number {
    return this.buckets.size;
  }
}
