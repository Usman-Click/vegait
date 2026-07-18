// ==============================================
// RateFlow — Load Tests: Throughput
// Measures performance under sustained load
// ==============================================

import { describe, it, expect, afterEach } from "vitest";
import { InMemoryLimiter } from "@/lib/rate-limiter/in-memory-limiter";

describe("Load Tests", () => {
  let limiter: InMemoryLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("should process 10,000 requests in under 100ms", () => {
    limiter = new InMemoryLimiter();

    const start = performance.now();

    for (let i = 0; i < 10_000; i++) {
      limiter.check(`load-client-${i % 100}`, 1000, 60);
    }

    const elapsed = performance.now() - start;

    // 10K requests should complete well under 100ms for in-memory
    expect(elapsed).toBeLessThan(100);
  });

  it("should handle 1,000 unique clients without memory issues", () => {
    limiter = new InMemoryLimiter();

    for (let i = 0; i < 1000; i++) {
      limiter.check(`unique-client-${i}`, 100, 60);
    }

    expect(limiter.size).toBe(1000);

    // Verify each client got tokens
    const result = limiter.check("unique-client-0", 100, 60);
    expect(result.allowed).toBe(true);
  });

  it("should maintain accuracy under sustained load", () => {
    limiter = new InMemoryLimiter();
    const limit = 100;
    const clientId = "sustained-client";

    // Phase 1: Exhaust all tokens
    let allowed = 0;
    for (let i = 0; i < 200; i++) {
      if (limiter.check(clientId, limit, 60).allowed) {
        allowed++;
      }
    }

    expect(allowed).toBe(limit);

    // Phase 2: All subsequent requests should be rejected
    for (let i = 0; i < 50; i++) {
      const result = limiter.check(clientId, limit, 60);
      expect(result.allowed).toBe(false);
    }
  });

  it("should handle rapid create-check-reset cycles", () => {
    limiter = new InMemoryLimiter();

    for (let cycle = 0; cycle < 100; cycle++) {
      const clientId = `cycle-client-${cycle}`;

      // Check
      const result = limiter.check(clientId, 10, 60);
      expect(result.allowed).toBe(true);

      // Reset
      limiter.reset(clientId);

      // Check again — should have full tokens
      const afterReset = limiter.check(clientId, 10, 60);
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(9);
    }
  });
});
