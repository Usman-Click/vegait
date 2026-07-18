// ==============================================
// RateFlow — BullMQ Queue
// Async log processing queue for request logging
// ==============================================

import { Queue } from "bullmq";
import { redis } from "./redis";
import { LOG_QUEUE_NAME } from "./constants";
import type { LogJobData } from "@/types";

/**
 * Global singleton for the BullMQ queue.
 * Uses the same Redis connection as the rate limiter.
 */

const globalForQueue = globalThis as unknown as {
  logQueue: Queue | undefined;
};

function createQueue(): Queue {
  return new Queue(LOG_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
      removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs for debugging
      attempts: 3, // Retry failed jobs up to 3 times
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  });
}

export const logQueue = globalForQueue.logQueue ?? createQueue();

if (process.env.NODE_ENV !== "production") {
  globalForQueue.logQueue = logQueue;
}

/**
 * Enqueues a request log entry for async processing.
 * This is called from the /api/check route handler after the rate limit decision.
 * The BullMQ worker picks up these jobs and writes them to PostgreSQL.
 */
export async function enqueueLog(data: LogJobData): Promise<void> {
  try {
    await logQueue.add("process-log", data, {
      // Use clientId + timestamp as a deduplication key
      jobId: `${data.clientId}-${data.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    });
  } catch (error) {
    // Log but don't throw — we never want queue failures to block API responses
    console.error("[Queue] Failed to enqueue log:", error);
  }
}
