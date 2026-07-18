// ==============================================
// RateFlow — POST /api/check
// Core rate-check endpoint
// Clients call this to check if a request is allowed
// ==============================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimiter } from "@/lib/rate-limiter/rate-limiter";
import { enqueueLog } from "@/lib/queue";
import { checkRequestSchema } from "@/lib/validators/check";

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

    // Look up client by API key (check both primary key and ApiKey table)
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { apiKey, active: true },
          { apiKeys: { some: { key: apiKey, active: true } } },
        ],
      },
    });

    if (!client) {
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

    const responseTime = Date.now() - startTime;

    // Enqueue log entry asynchronously (never blocks the response)
    await enqueueLog({
      clientId: client.id,
      endpoint,
      allowed: result.allowed,
      responseTime,
      timestamp: new Date().toISOString(),
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
