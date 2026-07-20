// ==============================================
// RateFlow — Dashboard Overview Page
// Main dashboard with stats + chart
// ==============================================

"use client";

import { useState, useMemo } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RequestChart } from "@/components/dashboard/request-chart";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAnalytics(days);

  // Aggregate today's stats from the analytics data (memoized)
  const stats = useMemo(() => {
    if (!data?.data) return null;
    return {
      totalRequests: data.data.reduce(
        (sum: number, d: { totalRequests: number }) => sum + d.totalRequests,
        0
      ),
      approvedRequests: data.data.reduce(
        (sum: number, d: { approvedRequests: number }) =>
          sum + d.approvedRequests,
        0
      ),
      rejectedRequests: data.data.reduce(
        (sum: number, d: { rejectedRequests: number }) =>
          sum + d.rejectedRequests,
        0
      ),
      averageResponseTime: data.data.length
        ? data.data.reduce(
            (sum: number, d: { averageResponseTime: number }) =>
              sum + d.averageResponseTime,
            0
          ) / data.data.length
        : 0,
    };
  }, [data?.data]);

  return (
    <div className="space-y-6">
      {/* Dashboard Subtitle Description */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Monitor API traffic, rate limits, and system health in real time.
        </p>
      </div>
      {/* Stats summary */}
      <StatsCards data={stats} isLoading={isLoading} />

      {/* Chart with date filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Request Volume</h2>
        <DateRangeFilter value={days} onChange={setDays} />
      </div>

      <RequestChart
        data={data?.data || []}
        isLoading={isLoading}
        title={`Last ${days} Days`}
      />
    </div>
  );
}
