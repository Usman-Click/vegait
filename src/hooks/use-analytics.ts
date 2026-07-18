// ==============================================
// RateFlow — React Query Hooks: Analytics
// ==============================================

"use client";

import { useQuery } from "@tanstack/react-query";

/** Fetches analytics data for the specified time range */
export function useAnalytics(days: number, clientId?: string) {
  return useQuery({
    queryKey: ["analytics", days, clientId],
    queryFn: async () => {
      const params = new URLSearchParams({ days: days.toString() });
      if (clientId) params.set("clientId", clientId);
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

/** Fetches dashboard summary stats */
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?days=1");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for live feel
  });
}
