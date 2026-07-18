// ==============================================
// RateFlow — Unit Tests: Rate Limiter Facade
// Tests the unified limiter with failover behavior
// ==============================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limiter/rate-limiter";

// Mock Redis client
function createMockRedis() {
  return {
    eval: vi.fn(),
    del: vi.fn(),
  } as any;
}

describe("RateLimiter (unified)", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let limiter: RateLimiter;

  beforeEach(() => {
    redis = createMockRedis();
    limiter = new RateLimiter(redis);
  });

  afterEach(() => {
    limiter.destroy();
  });

  it("should use Redis when available", async () => {
    redis.eval.mockResolvedValue([1, 99, 0]);

    const result = await limiter.check("client-1", 100, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(limiter.isDegraded()).toBe(false);
    expect(limiter.getMode()).toBe("redis");
  });

  it("should fall back to in-memory when Redis fails", async () => {
    redis.eval.mockRejectedValue(new Error("Connection refused"));

    const result = await limiter.check("client-1", 100, 60);

    expect(result.allowed).toBe(true); // First request to in-memory starts full
    expect(limiter.isDegraded()).toBe(true);
    expect(limiter.getMode()).toBe("in-memory");
  });

  it("should recover from degraded mode when Redis comes back", async () => {
    // First call fails — triggers degraded mode
    redis.eval.mockRejectedValueOnce(new Error("Connection refused"));
    await limiter.check("client-1", 100, 60);
    expect(limiter.isDegraded()).toBe(true);

    // Second call succeeds — should recover
    redis.eval.mockResolvedValue([1, 98, 0]);
    await limiter.check("client-1", 100, 60);
    expect(limiter.isDegraded()).toBe(false);
    expect(limiter.getMode()).toBe("redis");
  });

  it("should continue working in degraded mode for multiple requests", async () => {
    redis.eval.mockRejectedValue(new Error("Connection refused"));

    // All requests should work via in-memory
    for (let i = 0; i < 5; i++) {
      const result = await limiter.check("client-1", 10, 60);
      expect(result.allowed).toBe(true);
    }

    expect(limiter.isDegraded()).toBe(true);
  });

  it("should reset both Redis and in-memory", async () => {
    redis.del.mockResolvedValue(1);

    await limiter.reset("client-1");

    expect(redis.del).toHaveBeenCalled();
  });

  it("should not throw when Redis reset fails", async () => {
    redis.del.mockRejectedValue(new Error("Connection refused"));

    // Should not throw
    await expect(limiter.reset("client-1")).resolves.not.toThrow();
  });
});
