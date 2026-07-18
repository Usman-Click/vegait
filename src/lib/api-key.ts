// ==============================================
// RateFlow — API Key Generator
// Cryptographically secure API key generation
// ==============================================

import { randomBytes } from "crypto";
import { API_KEY_PREFIX, API_KEY_LENGTH } from "./constants";

/**
 * Generates a cryptographically secure API key.
 * Format: rf_<32 random hex characters>
 * Example: rf_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(API_KEY_LENGTH / 2).toString("hex");
  return `${API_KEY_PREFIX}${randomPart}`;
}
