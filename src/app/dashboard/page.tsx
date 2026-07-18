// ==============================================
// RateFlow — Dashboard Overview Page
// Main dashboard with stats + chart
// ==============================================

"use client";

import { useState } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RequestChart } from "@/components/dashboard/request-chart";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAnalytics(days);

  // Aggregate today's stats from the analytics data
  const stats = data?.data
    ? {
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
      }
    : null;

  return (
    <div className="space-y-6">
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
