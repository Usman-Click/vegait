// ==============================================
// RateFlow — POST /api/check
// Core rate-check endpoint
// Clients call this to check if a request is allowed
// ==============================================

import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { rateLimiter } from "@/lib/rate-limiter/rate-limiter";
import { enqueueLog } from "@/lib/queue";
import { checkRequestSchema } from "@/lib/validators/check";

const CLIENT_CACHE_PREFIX = "rateflow:client-cache:";
const CACHE_TTL_SECONDS = 300; // 5 minutes
const NEGATIVE_CACHE_TTL_SECONDS = 30; // 30 seconds

interface CachedClient {
  id: string;
  name: string;
  apiKey: string;
  rateLimit: number;
  windowSeconds: number;
  active: boolean;
}

/**
 * Retrieves client settings using Redis cache as the primary layer.
 * Falls back to PostgreSQL on cache miss and sets the cache with TTL.
 * Implements negative caching for invalid keys to protect DB from spam.
 */
async function getCachedClient(apiKey: string): Promise<CachedClient | null | "NOT_FOUND"> {
  const cacheKey = `${CLIENT_CACHE_PREFIX}${apiKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      if (cached === "NOT_FOUND") return "NOT_FOUND";
      return JSON.parse(cached) as CachedClient;
    }
  } catch (err) {
    console.error("[Cache Get Error]", err);
  }

  // Database lookup
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { apiKey, active: true },
        { apiKeys: { some: { key: apiKey, active: true } } },
      ],
    },
  });

  try {
    if (client) {
      const cacheData: CachedClient = {
        id: client.id,
        name: client.name,
        apiKey: client.apiKey,
        rateLimit: client.rateLimit,
        windowSeconds: client.windowSeconds,
        active: client.active,
      };
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(cacheData));
      return cacheData;
    } else {
      await redis.setex(cacheKey, NEGATIVE_CACHE_TTL_SECONDS, "NOT_FOUND");
      return "NOT_FOUND";
    }
  } catch (err) {
    console.error("[Cache Set Error]", err);
  }

  return client;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    const body = await request.json();
    const parsed = checkRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { apiKey, endpoint } = parsed.data;

    // Look up client by API key (cached)
    const client = await getCachedClient(apiKey);

    if (!client || client === "NOT_FOUND") {
      return Response.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    // Check rate limit
    const result = await rateLimiter.check(
      client.id,
      client.rateLimit,
      client.windowSeconds
    );

    // Enqueue log entry asynchronously after response is sent (using Next.js after API)
    after(async () => {
      try {
        const responseTime = Date.now() - startTime;
        await enqueueLog({
          clientId: client.id,
          endpoint,
          allowed: result.allowed,
          responseTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[After Enqueue Log Error]", err);
      }
    });

    // Return rate limit decision with standard headers
    const response = Response.json(
      {
        allowed: result.allowed,
        remaining: result.remaining,
        retryAfter: result.retryAfter,
      },
      { status: result.allowed ? 200 : 429 }
    );

    return response;
  } catch (error) {
    console.error("[API /check] Error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
