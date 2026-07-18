// ==============================================
// RateFlow — Shared TypeScript Types
// Central type definitions used across the application
// ==============================================

/** Result returned by the rate limiter after checking a request */
export interface RateLimitResult {
  /** Whether the request is allowed through */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Seconds until the client can retry (0 if allowed) */
  retryAfter: number;
}

/** Shape of data sent to BullMQ for async log processing */
export interface LogJobData {
  clientId: string;
  endpoint: string;
  allowed: boolean;
  responseTime: number;
  timestamp: string;
}

/** Health status for individual service components */
export interface ServiceHealth {
  status: "healthy" | "degraded" | "down";
  latency?: number;
  message?: string;
}

/** Aggregated health response from GET /api/health */
export interface HealthResponse {
  status: "healthy" | "degraded" | "down";
  timestamp: string;
  services: {
    redis: ServiceHealth;
    database: ServiceHealth;
    queue: ServiceHealth;
  };
  rateLimiter: {
    mode: "redis" | "in-memory";
    degraded: boolean;
  };
}

/** Shape of the check request body */
export interface CheckRequest {
  apiKey: string;
  endpoint: string;
}

/** Shape of the check response */
export interface CheckResponse {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/** Dashboard stats summary */
export interface DashboardStats {
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
}

/** Analytics data point for charts */
export interface AnalyticsDataPoint {
  date: string;
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
