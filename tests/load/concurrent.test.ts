// ==============================================
// RateFlow — Load Tests: Concurrent Requests
// Tests the in-memory limiter under concurrent load
// ==============================================

import { describe, it, expect, afterEach } from "vitest";
import { InMemoryLimiter } from "@/lib/rate-limiter/in-memory-limiter";

describe("Concurrent Request Tests", () => {
  let limiter: InMemoryLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("should handle 100 concurrent requests without errors", async () => {
    limiter = new InMemoryLimiter();

    const promises = Array.from({ length: 100 }, (_, i) =>
      Promise.resolve(limiter.check(`client-${i % 5}`, 100, 60))
    );

    const results = await Promise.all(promises);

    // All should resolve without errors
    expect(results).toHaveLength(100);
    results.forEach((r) => {
      expect(r).toHaveProperty("allowed");
      expect(r).toHaveProperty("remaining");
      expect(r).toHaveProperty("retryAfter");
    });
  });

  it("should correctly enforce limits under concurrent load for a single client", async () => {
    limiter = new InMemoryLimiter();
    const limit = 20;

    // Fire 50 requests for the same client with a limit of 20
    const promises = Array.from({ length: 50 }, () =>
      Promise.resolve(limiter.check("single-client", limit, 60))
    );

    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r.allowed).length;
    const rejected = results.filter((r) => !r.allowed).length;

    // Exactly `limit` should be allowed (since they run synchronously in JS)
    expect(allowed).toBe(limit);
    expect(rejected).toBe(50 - limit);
  });

  it("should handle high-throughput burst for multiple clients", async () => {
    limiter = new InMemoryLimiter();

    // 10 clients, 100 requests each = 1000 total
    const promises: Promise<{ allowed: boolean }>[] = [];
    for (let client = 0; client < 10; client++) {
      for (let req = 0; req < 100; req++) {
        promises.push(
          Promise.resolve(limiter.check(`burst-client-${client}`, 50, 60))
        );
      }
    }

    const results = await Promise.all(promises);

    // All should complete
    expect(results).toHaveLength(1000);

    // Each client should have at most 50 allowed
    for (let client = 0; client < 10; client++) {
      const clientResults = results.slice(client * 100, (client + 1) * 100);
      const allowed = clientResults.filter((r) => r.allowed).length;
      expect(allowed).toBeLessThanOrEqual(50);
    }
  });
});
