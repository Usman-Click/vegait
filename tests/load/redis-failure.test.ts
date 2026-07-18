// ==============================================
// RateFlow — Load Tests: Redis Failure Simulation
// Verifies graceful failover to in-memory limiter
// ==============================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limiter/rate-limiter";

describe("Redis Failure Tests", () => {
  let limiter: RateLimiter;

  function createMockRedis(shouldFail: boolean) {
    return {
      eval: shouldFail
        ? vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
        : vi.fn().mockResolvedValue([1, 99, 0]),
      del: shouldFail
        ? vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
        : vi.fn().mockResolvedValue(1),
    } as any;
  }

  afterEach(() => {
    limiter?.destroy();
  });

  it("should seamlessly switch to in-memory when Redis goes down", async () => {
    limiter = new RateLimiter(createMockRedis(true));

    // Should not throw — falls back to in-memory
    const result = await limiter.check("client-1", 100, 60);

    expect(result.allowed).toBe(true);
    expect(limiter.isDegraded()).toBe(true);
    expect(limiter.getMode()).toBe("in-memory");
  });

  it("should continue serving requests during Redis outage", async () => {
    limiter = new RateLimiter(createMockRedis(true));

    // Simulate 50 requests during outage
    const results = [];
    for (let i = 0; i < 50; i++) {
      results.push(await limiter.check("outage-client", 100, 60));
    }

    // All should have been processed (not thrown)
    expect(results).toHaveLength(50);
    expect(results.filter((r) => r.allowed)).toHaveLength(50);
    expect(limiter.isDegraded()).toBe(true);
  });

  it("should enforce rate limits even in degraded mode", async () => {
    limiter = new RateLimiter(createMockRedis(true));
    const limit = 5;

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(await limiter.check("strict-client", limit, 60));
    }

    const allowed = results.filter((r) => r.allowed).length;
    const rejected = results.filter((r) => !r.allowed).length;

    expect(allowed).toBe(limit);
    expect(rejected).toBe(5);
  });

  it("should recover when Redis becomes available again", async () => {
    const failingRedis = createMockRedis(true);
    limiter = new RateLimiter(failingRedis);

    // Trigger degraded mode
    await limiter.check("recovery-client", 100, 60);
    expect(limiter.isDegraded()).toBe(true);

    // "Fix" Redis
    failingRedis.eval.mockResolvedValue([1, 98, 0]);

    // Should recover
    await limiter.check("recovery-client", 100, 60);
    expect(limiter.isDegraded()).toBe(false);
    expect(limiter.getMode()).toBe("redis");
  });

  it("should handle intermittent Redis failures gracefully", async () => {
    const flappingRedis = createMockRedis(false);
    limiter = new RateLimiter(flappingRedis);

    // Success
    await limiter.check("flap-client", 100, 60);
    expect(limiter.isDegraded()).toBe(false);

    // Fail
    flappingRedis.eval.mockRejectedValueOnce(new Error("Timeout"));
    await limiter.check("flap-client", 100, 60);
    expect(limiter.isDegraded()).toBe(true);

    // Recover
    flappingRedis.eval.mockResolvedValue([1, 97, 0]);
    await limiter.check("flap-client", 100, 60);
    expect(limiter.isDegraded()).toBe(false);
  });

  it("should never block all traffic regardless of Redis state", async () => {
    limiter = new RateLimiter(createMockRedis(true));

    // Even with Redis down, first requests within limit should pass
    const result = await limiter.check("never-block", 1000, 60);
    expect(result.allowed).toBe(true);
  });
});
