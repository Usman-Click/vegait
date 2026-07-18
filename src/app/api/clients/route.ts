// ==============================================
// RateFlow — GET + POST /api/clients
// List all clients (paginated) and create new clients
// ==============================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-key";
import { createClientSchema } from "@/lib/validators/client";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/clients
 * Returns a paginated list of clients with optional search.
 *
 * Query params:
 *   page (default: 1)
 *   pageSize (default: 10, max: 100)
 *   search (optional, filters by client name)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10))
    );
    const search = searchParams.get("search") || "";

    // Build where clause with optional search filter
    const where = search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {};

    // Execute count and data queries in parallel
    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { requestLogs: true, apiKeys: true },
          },
        },
      }),
    ]);

    return Response.json({
      data: clients,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[API /clients GET] Error:", error);
    return Response.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Creates a new client with an auto-generated API key.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const apiKey = generateApiKey();

    // Create client and its first API key in a transaction
    const client = await prisma.$transaction(async (tx) => {
      const newClient = await tx.client.create({
        data: {
          name: parsed.data.name,
          apiKey,
          rateLimit: parsed.data.rateLimit,
          windowSeconds: parsed.data.windowSeconds,
        },
      });

      // Also create an entry in the ApiKey table
      await tx.apiKey.create({
        data: {
          clientId: newClient.id,
          key: apiKey,
        },
      });

      return newClient;
    });

    return Response.json(client, { status: 201 });
  } catch (error) {
    console.error("[API /clients POST] Error:", error);
    return Response.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
