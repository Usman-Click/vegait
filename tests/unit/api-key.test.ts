// ==============================================
// RateFlow — Unit Tests: API Key Generator
// ==============================================

import { describe, it, expect } from "vitest";
import { generateApiKey } from "@/lib/api-key";

describe("generateApiKey", () => {
  it("should generate a key with the rf_ prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("rf_")).toBe(true);
  });

  it("should generate keys of consistent length", () => {
    const key = generateApiKey();
    // rf_ (3 chars) + 32 hex chars = 35 total
    expect(key.length).toBe(35);
  });

  it("should generate unique keys on each call", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateApiKey());
    }
    // All 100 keys should be unique
    expect(keys.size).toBe(100);
  });

  it("should only contain valid hex characters after prefix", () => {
    const key = generateApiKey();
    const hexPart = key.slice(3); // Remove "rf_"
    expect(hexPart).toMatch(/^[0-9a-f]+$/);
  });
});
