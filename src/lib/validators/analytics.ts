// ==============================================
// RateFlow — Zod Validators: Analytics Queries
// ==============================================

import { z } from "zod";

/** Validates query params for GET /api/analytics */
export const analyticsQuerySchema = z.object({
  clientId: z.string().optional(),
  days: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(90))
    .optional()
    .default("30"),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
