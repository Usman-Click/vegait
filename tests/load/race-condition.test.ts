// ==============================================
// RateFlow — Load Tests: Race Conditions
// Verifies no tokens are over-consumed under contention
// ==============================================

import { describe, it, expect, afterEach } from "vitest";
import { InMemoryLimiter } from "@/lib/rate-limiter/in-memory-limiter";

describe("Race Condition Tests", () => {
  let limiter: InMemoryLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("should never allow more requests than the configured limit", () => {
    limiter = new InMemoryLimiter();
    const limit = 10;
    let allowedCount = 0;

    // Rapidly fire requests synchronously
    for (let i = 0; i < 100; i++) {
      const result = limiter.check("race-client", limit, 60);
      if (result.allowed) allowedCount++;
    }

    // In-memory limiter is synchronous, so no race conditions possible in JS
    // But we verify the invariant holds: never more than `limit` allowed
    expect(allowedCount).toBe(limit);
  });

  it("should maintain correct counts across interleaved client requests", () => {
    limiter = new InMemoryLimiter();
    const counts = new Map<string, number>();

    // Interleave requests between 3 clients
    for (let i = 0; i < 150; i++) {
      const clientId = `client-${i % 3}`;
      const result = limiter.check(clientId, 10, 60);
      if (result.allowed) {
        counts.set(clientId, (counts.get(clientId) || 0) + 1);
      }
    }

    // Each client should have exactly 10 allowed requests
    expect(counts.get("client-0")).toBe(10);
    expect(counts.get("client-1")).toBe(10);
    expect(counts.get("client-2")).toBe(10);
  });

  it("should not leak tokens between consecutive windows", () => {
    limiter = new InMemoryLimiter();
    const limit = 5;

    // Exhaust tokens
    for (let i = 0; i < limit; i++) {
      expect(limiter.check("window-client", limit, 60).allowed).toBe(true);
    }

    // Should be exhausted
    expect(limiter.check("window-client", limit, 60).allowed).toBe(false);

    // Reset simulates a new window
    limiter.reset("window-client");

    // Should have full tokens again
    expect(limiter.check("window-client", limit, 60).allowed).toBe(true);
    expect(limiter.check("window-client", limit, 60).remaining).toBe(3);
  });
});
