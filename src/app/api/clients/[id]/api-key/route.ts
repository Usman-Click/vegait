// ==============================================
// RateFlow — POST /api/clients/[id]/api-key
// Generate a new API key for a client
// ==============================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-key";

/**
 * POST /api/clients/:id/api-key
 * Generates a new API key for the specified client.
 * The old keys remain active unless explicitly deactivated.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      return Response.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const newKey = generateApiKey();

    // Create the new API key and update the client's primary key
    const [apiKeyRecord] = await prisma.$transaction([
      prisma.apiKey.create({
        data: {
          clientId: id,
          key: newKey,
        },
      }),
      prisma.client.update({
        where: { id },
        data: { apiKey: newKey },
      }),
    ]);

    return Response.json(
      { key: apiKeyRecord.key, id: apiKeyRecord.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API /clients/:id/api-key POST] Error:", error);
    return Response.json(
      { error: "Failed to generate API key" },
      { status: 500 }
    );
  }
}
