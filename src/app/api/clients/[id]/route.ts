// ==============================================
// RateFlow — GET + PATCH + DELETE /api/clients/[id]
// Single client operations: read, update, delete
// ==============================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateClientSchema } from "@/lib/validators/client";

/**
 * GET /api/clients/:id
 * Returns a single client with its API keys and recent stats.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        apiKeys: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { requestLogs: true },
        },
      },
    });

    if (!client) {
      return Response.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return Response.json(client);
  } catch (error) {
    console.error("[API /clients/:id GET] Error:", error);
    return Response.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/:id
 * Updates client properties (name, rate limit, window, active status).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check client exists
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const client = await prisma.client.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json(client);
  } catch (error) {
    console.error("[API /clients/:id PATCH] Error:", error);
    return Response.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/:id
 * Permanently deletes a client and all related data (cascade).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check client exists
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    await prisma.client.delete({ where: { id } });

    return Response.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error("[API /clients/:id DELETE] Error:", error);
    return Response.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
