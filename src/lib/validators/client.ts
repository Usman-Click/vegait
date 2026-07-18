// ==============================================
// RateFlow — Zod Validators: Client CRUD
// ==============================================

import { z } from "zod";

/** Validates the POST /api/clients request body (create client) */
export const createClientSchema = z.object({
  name: z
    .string()
    .min(1, "Client name is required")
    .max(100, "Client name too long"),
  rateLimit: z
    .number()
    .int("Rate limit must be an integer")
    .min(1, "Rate limit must be at least 1")
    .max(100000, "Rate limit cannot exceed 100,000"),
  windowSeconds: z
    .number()
    .int("Window must be an integer")
    .min(1, "Window must be at least 1 second")
    .max(86400, "Window cannot exceed 24 hours"),
});

/** Validates the PATCH /api/clients/:id request body (update client) */
export const updateClientSchema = z.object({
  name: z
    .string()
    .min(1, "Client name is required")
    .max(100, "Client name too long")
    .optional(),
  rateLimit: z
    .number()
    .int("Rate limit must be an integer")
    .min(1, "Rate limit must be at least 1")
    .max(100000, "Rate limit cannot exceed 100,000")
    .optional(),
  windowSeconds: z
    .number()
    .int("Window must be an integer")
    .min(1, "Window must be at least 1 second")
    .max(86400, "Window cannot exceed 24 hours")
    .optional(),
  active: z.boolean().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
