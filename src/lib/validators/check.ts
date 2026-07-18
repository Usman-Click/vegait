// ==============================================
// RateFlow — Zod Validators: Check Endpoint
// ==============================================

import { z } from "zod";

/** Validates the POST /api/check request body */
export const checkRequestSchema = z.object({
  apiKey: z
    .string()
    .min(1, "API key is required")
    .startsWith("rf_", "Invalid API key format"),
  endpoint: z
    .string()
    .min(1, "Endpoint is required")
    .max(500, "Endpoint too long"),
});

export type CheckRequestInput = z.infer<typeof checkRequestSchema>;
