// ==============================================
// RateFlow — React Query Hook: Health
// ==============================================

"use client";

import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@/types";

/** Fetches system health status with auto-refresh */
export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      // Don't throw on 503 — that's expected when degraded
      return res.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds for real-time health
  });
}
