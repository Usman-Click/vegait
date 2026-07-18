// ==============================================
// RateFlow — Unit Tests: In-Memory Limiter
// Tests the fallback in-memory rate limiter
// ==============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryLimiter } from "@/lib/rate-limiter/in-memory-limiter";

describe("InMemoryLimiter", () => {
  let limiter: InMemoryLimiter;

  beforeEach(() => {
    limiter = new InMemoryLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it("should allow requests when tokens are available", () => {
    const result = limiter.check("client-1", 10, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.retryAfter).toBe(0);
  });

  it("should track remaining tokens correctly", () => {
    // Consume all 5 tokens
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("client-1", 5, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }

    // 6th request should be rejected
    const result = limiter.check("client-1", 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("should isolate clients from each other", () => {
    // Exhaust client-1
    for (let i = 0; i < 3; i++) {
      limiter.check("client-1", 3, 60);
    }
    const exhausted = limiter.check("client-1", 3, 60);
    expect(exhausted.allowed).toBe(false);

    // client-2 should still have tokens
    const result = limiter.check("client-2", 3, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("should reset a client's bucket", () => {
    // Exhaust tokens
    for (let i = 0; i < 3; i++) {
      limiter.check("client-1", 3, 60);
    }
    expect(limiter.check("client-1", 3, 60).allowed).toBe(false);

    // Reset
    limiter.reset("client-1");

    // Should have full tokens again
    const result = limiter.check("client-1", 3, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("should track the number of active buckets", () => {
    limiter.check("client-1", 10, 60);
    limiter.check("client-2", 10, 60);
    limiter.check("client-3", 10, 60);

    expect(limiter.size).toBe(3);

    limiter.reset("client-2");
    expect(limiter.size).toBe(2);
  });

  it("should handle single-token buckets", () => {
    const first = limiter.check("client-1", 1, 60);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);

    const second = limiter.check("client-1", 1, 60);
    expect(second.allowed).toBe(false);
  });

  it("should provide retryAfter > 0 when rejected", () => {
    // Exhaust all tokens
    limiter.check("client-1", 1, 60);
    const result = limiter.check("client-1", 1, 60);

    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("should clean up properly on destroy", () => {
    limiter.check("client-1", 10, 60);
    limiter.check("client-2", 10, 60);

    limiter.destroy();
    expect(limiter.size).toBe(0);
  });
});
