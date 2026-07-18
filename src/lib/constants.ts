// ==============================================
// RateFlow — Constants
// Application-wide configuration values and presets
// ==============================================

/** Pre-defined rate limit tiers for quick client setup */
export const RATE_LIMIT_PRESETS = {
  /** Basic tier: 100 requests per minute */
  basic: { rateLimit: 100, windowSeconds: 60 },
  /** Pro tier: 1000 requests per minute */
  pro: { rateLimit: 1000, windowSeconds: 60 },
  /** Enterprise tier: 5000 requests per minute */
  enterprise: { rateLimit: 5000, windowSeconds: 60 },
} as const;

/** BullMQ queue name for request log processing */
export const LOG_QUEUE_NAME = "request-logs";

/** Redis key prefix for rate limiter token buckets */
export const REDIS_KEY_PREFIX = "rateflow:bucket:";

/** Default page size for paginated queries */
export const DEFAULT_PAGE_SIZE = 10;

/** Maximum page size to prevent abuse */
export const MAX_PAGE_SIZE = 100;

/** API key prefix for easy identification */
export const API_KEY_PREFIX = "rf_";

/** API key length (excluding prefix) */
export const API_KEY_LENGTH = 32;
