// ==============================================
// RateFlow — Health Page
// Live system health monitoring
// ==============================================

"use client";

import {
  Database,
  Server,
  Layers,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth } from "@/hooks/use-health";
import type { ServiceHealth } from "@/types";

/** Maps health status to badge variant and icon */
function getStatusDisplay(status: ServiceHealth["status"]) {
  switch (status) {
    case "healthy":
      return {
        variant: "success" as const,
        icon: CheckCircle2,
        label: "Healthy",
      };
    case "degraded":
      return {
        variant: "warning" as const,
        icon: AlertTriangle,
        label: "Degraded",
      };
    case "down":
      return {
        variant: "destructive" as const,
        icon: XCircle,
        label: "Down",
      };
  }
}

/** Individual service health card */
function ServiceCard({
  title,
  icon: Icon,
  health,
  isLoading,
}: {
  title: string;
  icon: typeof Server;
  health?: ServiceHealth;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  const status = health ? getStatusDisplay(health.status) : null;
  const StatusIcon = status?.icon || AlertTriangle;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        {status && <Badge variant={status.variant}>{status.label}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={`h-4 w-4 ${
              health?.status === "healthy"
                ? "text-emerald-500"
                : health?.status === "degraded"
                  ? "text-amber-500"
                  : "text-red-500"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {health?.message || "Unknown"}
          </span>
        </div>
        {health?.latency !== undefined && (
          <p className="text-xs text-muted-foreground">
            Latency:{" "}
            <span className="font-mono font-medium">{health.latency}ms</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function HealthPage() {
  const { data, isLoading } = useHealth();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Real-time system health monitoring. Auto-refreshes every 5 seconds.
      </p>

      {/* Overall status */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                data?.status === "healthy"
                  ? "bg-emerald-500 animate-pulse"
                  : data?.status === "degraded"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-red-500 animate-pulse"
              }`}
            />
            <div>
              <p className="font-semibold">System Status</p>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Checking..."
                  : data?.status === "healthy"
                    ? "All systems operational"
                    : data?.status === "degraded"
                      ? "Operating in degraded mode"
                      : "System issues detected"}
              </p>
            </div>
          </div>
          {data && (
            <Badge
              variant={
                data.status === "healthy"
                  ? "success"
                  : data.status === "degraded"
                    ? "warning"
                    : "destructive"
              }
            >
              {data.status.toUpperCase()}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Service cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ServiceCard
          title="Redis"
          icon={Server}
          health={data?.services.redis}
          isLoading={isLoading}
        />
        <ServiceCard
          title="PostgreSQL"
          icon={Database}
          health={data?.services.database}
          isLoading={isLoading}
        />
        <ServiceCard
          title="Queue"
          icon={Layers}
          health={data?.services.queue}
          isLoading={isLoading}
        />

        {/* Rate Limiter mode card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">
                Rate Limiter
              </CardTitle>
            </div>
            {data && (
              <Badge
                variant={data.rateLimiter.degraded ? "warning" : "success"}
              >
                {data.rateLimiter.mode}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {data?.rateLimiter.degraded ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    Mode: {data?.rateLimiter.mode || "unknown"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {data?.rateLimiter.degraded
                    ? "Using in-memory fallback (not distributed)"
                    : "Using Redis-backed distributed limiter"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last checked timestamp */}
      {data?.timestamp && (
        <p className="text-xs text-muted-foreground text-right">
          Last checked: {new Date(data.timestamp).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
