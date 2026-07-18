// ==============================================
// RateFlow — Dashboard: Stats Cards
// KPI summary cards for the overview page
// ==============================================

"use client";

import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  data: {
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    averageResponseTime: number;
  } | null;
  isLoading: boolean;
}

/** Formats large numbers with K/M suffixes */
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

const cards = [
  {
    title: "Total Requests",
    key: "totalRequests" as const,
    icon: Activity,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    format: formatNumber,
  },
  {
    title: "Approved",
    key: "approvedRequests" as const,
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    format: formatNumber,
  },
  {
    title: "Rejected",
    key: "rejectedRequests" as const,
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    format: formatNumber,
  },
  {
    title: "Avg Response Time",
    key: "averageResponseTime" as const,
    icon: Clock,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    format: (n: number) => `${n.toFixed(1)}ms`,
  },
];

export function StatsCards({ data, isLoading }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">
                {data ? card.format(data[card.key]) : "0"}
              </p>
            )}
          </CardContent>
          {/* Subtle gradient accent line at top */}
          <div
            className={`absolute top-0 left-0 right-0 h-px ${card.bgColor}`}
          />
        </Card>
      ))}
    </div>
  );
}
