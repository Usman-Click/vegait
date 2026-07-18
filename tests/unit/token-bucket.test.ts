// ==============================================
// RateFlow — Unit Tests: Token Bucket
// Tests the Redis Lua script-based token bucket
// ==============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenBucketLimiter } from "@/lib/rate-limiter/token-bucket";

// Mock Redis client
function createMockRedis() {
  return {
    eval: vi.fn(),
    del: vi.fn(),
  };
}

describe("TokenBucketLimiter", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let limiter: TokenBucketLimiter;

  beforeEach(() => {
    redis = createMockRedis();
    limiter = new TokenBucketLimiter(redis as any);
  });

  it("should allow a request when tokens are available", async () => {
    // Lua script returns: [allowed=1, remaining=99, retryAfter=0]
    redis.eval.mockResolvedValue([1, 99, 0]);

    const result = await limiter.check("client-1", 100, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.retryAfter).toBe(0);
  });

  it("should reject a request when no tokens remain", async () => {
    // Lua script returns: [allowed=0, remaining=0, retryAfter=3]
    redis.eval.mockResolvedValue([0, 0, 3]);

    const result = await limiter.check("client-1", 100, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBe(3);
  });

  it("should pass correct arguments to the Lua script", async () => {
    redis.eval.mockResolvedValue([1, 49, 0]);

    await limiter.check("test-client", 50, 30);

    // Verify the Lua script was called with correct args
    expect(redis.eval).toHaveBeenCalledTimes(1);
    const args = redis.eval.mock.calls[0];
    expect(args[1]).toBe(1); // 1 key
    expect(args[2]).toBe("rateflow:bucket:test-client"); // key
    expect(args[3]).toBe("50"); // maxTokens
    expect(args[4]).toBe("30"); // windowSeconds
    expect(typeof args[5]).toBe("string"); // now timestamp
  });

  it("should reset a client's bucket", async () => {
    redis.del.mockResolvedValue(1);

    await limiter.reset("client-1");

    expect(redis.del).toHaveBeenCalledWith("rateflow:bucket:client-1");
  });

  it("should ensure remaining is never negative", async () => {
    redis.eval.mockResolvedValue([0, -1, 5]);

    const result = await limiter.check("client-1", 100, 60);

    expect(result.remaining).toBe(0); // Clamped to 0
  });

  it("should ensure retryAfter is at least 1 when rejected", async () => {
    redis.eval.mockResolvedValue([0, 0, 0]);

    const result = await limiter.check("client-1", 100, 60);

    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });
});
