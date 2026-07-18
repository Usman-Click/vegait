// ==============================================
// RateFlow — GET /api/health
// System health check endpoint
// Reports status of Redis, PostgreSQL, BullMQ, and rate limiter mode
// ==============================================

import { prisma } from "@/lib/prisma";
import { checkRedisHealth } from "@/lib/redis";
import { logQueue } from "@/lib/queue";
import { rateLimiter } from "@/lib/rate-limiter/rate-limiter";
import type { HealthResponse, ServiceHealth } from "@/types";

export async function GET() {
  const timestamp = new Date().toISOString();

  // Check each service independently so one failure doesn't mask others
  const [redisHealth, dbHealth, queueHealth] = await Promise.all([
    checkRedisStatus(),
    checkDatabaseStatus(),
    checkQueueStatus(),
  ]);

  // Overall status: degraded if any service is degraded, down if any is down
  let overallStatus: HealthResponse["status"] = "healthy";
  const services = [redisHealth, dbHealth, queueHealth];

  if (services.some((s) => s.status === "down")) {
    overallStatus = "down";
  } else if (
    services.some((s) => s.status === "degraded") ||
    rateLimiter.isDegraded()
  ) {
    overallStatus = "degraded";
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp,
    services: {
      redis: redisHealth,
      database: dbHealth,
      queue: queueHealth,
    },
    rateLimiter: {
      mode: rateLimiter.getMode(),
      degraded: rateLimiter.isDegraded(),
    },
  };

  const httpStatus = overallStatus === "healthy" ? 200 : 503;
  return Response.json(response, { status: httpStatus });
}

/** Checks Redis connectivity by sending a PING */
async function checkRedisStatus(): Promise<ServiceHealth> {
  try {
    const latency = await checkRedisHealth();
    return { status: "healthy", latency, message: "Connected" };
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/** Checks PostgreSQL connectivity by running a trivial query */
async function checkDatabaseStatus(): Promise<ServiceHealth> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    return { status: "healthy", latency, message: "Connected" };
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/** Checks BullMQ queue status by inspecting waiting/active job counts */
async function checkQueueStatus(): Promise<ServiceHealth> {
  try {
    const start = Date.now();
    const [waiting, active] = await Promise.all([
      logQueue.getWaitingCount(),
      logQueue.getActiveCount(),
    ]);
    const latency = Date.now() - start;
    return {
      status: "healthy",
      latency,
      message: `Waiting: ${waiting}, Active: ${active}`,
    };
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Queue unavailable",
    };
  }
}
