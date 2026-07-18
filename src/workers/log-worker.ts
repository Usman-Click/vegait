// ==============================================
// RateFlow — BullMQ Log Worker
// Processes request log jobs asynchronously
// Writes to PostgreSQL: RequestLog + Analytics tables
// ==============================================
// This file runs as a standalone Node.js process via:
//   npm run worker
//   tsx src/workers/log-worker.ts
// ==============================================

import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { LOG_QUEUE_NAME } from "../lib/constants";
import type { LogJobData } from "../types";

// Create dedicated connections for the worker (not shared with the app)
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // BullMQ requires this for workers
});

const prisma = new PrismaClient();

/**
 * Processes a single log job.
 *
 * Uses a Prisma transaction to:
 * 1. Create a RequestLog entry
 * 2. Upsert the daily Analytics aggregate (incrementing counters
 *    and recalculating the running average response time)
 */
async function processLogJob(job: Job<LogJobData>): Promise<void> {
  const { clientId, endpoint, allowed, responseTime, timestamp } = job.data;
  const logDate = new Date(timestamp);

  // Truncate to day boundary for analytics grouping
  const dateOnly = new Date(
    logDate.getFullYear(),
    logDate.getMonth(),
    logDate.getDate()
  );

  await prisma.$transaction(async (tx) => {
    // 1. Create the request log entry
    await tx.requestLog.create({
      data: {
        clientId,
        endpoint,
        allowed,
        responseTime,
        timestamp: logDate,
      },
    });

    // 2. Upsert daily analytics for this client
    const existing = await tx.analytics.findUnique({
      where: {
        clientId_date: { clientId, date: dateOnly },
      },
    });

    if (existing) {
      // Update existing analytics row
      const newTotal = existing.totalRequests + 1;
      const newApproved = existing.approvedRequests + (allowed ? 1 : 0);
      const newRejected = existing.rejectedRequests + (allowed ? 0 : 1);

      // Running average: ((oldAvg * oldCount) + newValue) / newCount
      const newAvgResponseTime =
        (existing.averageResponseTime * existing.totalRequests + responseTime) /
        newTotal;

      await tx.analytics.update({
        where: { id: existing.id },
        data: {
          totalRequests: newTotal,
          approvedRequests: newApproved,
          rejectedRequests: newRejected,
          averageResponseTime: newAvgResponseTime,
        },
      });
    } else {
      // Create new analytics row for this day
      await tx.analytics.create({
        data: {
          clientId,
          date: dateOnly,
          totalRequests: 1,
          approvedRequests: allowed ? 1 : 0,
          rejectedRequests: allowed ? 0 : 1,
          averageResponseTime: responseTime,
        },
      });
    }
  });
}

// ---- Create and start the worker ----

const worker = new Worker<LogJobData>(LOG_QUEUE_NAME, processLogJob, {
  connection: redis,
  concurrency: 10, // Process up to 10 jobs in parallel
  limiter: {
    max: 100, // Max 100 jobs
    duration: 1000, // Per second — prevents DB overload
  },
});

// ---- Event handlers for monitoring ----

worker.on("completed", (job) => {
  console.log(`[Worker] ✓ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] ✗ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Worker] Error:", err.message);
});

worker.on("ready", () => {
  console.log("[Worker] Ready and listening for jobs...");
});

// ---- Graceful shutdown ----

async function shutdown() {
  console.log("[Worker] Shutting down gracefully...");
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[Worker] Started — processing queue: ${LOG_QUEUE_NAME}`);
