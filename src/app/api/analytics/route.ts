// ==============================================
// RateFlow — GET /api/analytics
// Returns aggregated analytics data for charts
// ==============================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analytics
 * Returns daily analytics data for the specified time range.
 *
 * Query params:
 *   clientId (optional) — filter to a specific client
 *   days (default: 30) — number of days of data to return
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const clientId = searchParams.get("clientId") || undefined;
    const days = Math.min(
      90,
      Math.max(1, parseInt(searchParams.get("days") || "30", 10))
    );

    // Calculate the start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Build where clause
    const where = {
      date: { gte: startDate },
      ...(clientId ? { clientId } : {}),
    };

    // Get daily analytics
    const analytics = await prisma.analytics.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        client: {
          select: { name: true },
        },
      },
    });

    // If no clientId filter, aggregate across all clients per day
    if (!clientId) {
      const aggregated = new Map<
        string,
        {
          date: string;
          totalRequests: number;
          approvedRequests: number;
          rejectedRequests: number;
          averageResponseTime: number;
          _count: number;
        }
      >();

      for (const entry of analytics) {
        const dateKey = entry.date.toISOString().split("T")[0];
        const existing = aggregated.get(dateKey);

        if (existing) {
          existing.totalRequests += entry.totalRequests;
          existing.approvedRequests += entry.approvedRequests;
          existing.rejectedRequests += entry.rejectedRequests;
          // Weighted average for response time
          existing.averageResponseTime =
            (existing.averageResponseTime * existing._count +
              entry.averageResponseTime) /
            (existing._count + 1);
          existing._count += 1;
        } else {
          aggregated.set(dateKey, {
            date: dateKey,
            totalRequests: entry.totalRequests,
            approvedRequests: entry.approvedRequests,
            rejectedRequests: entry.rejectedRequests,
            averageResponseTime: entry.averageResponseTime,
            _count: 1,
          });
        }
      }

      // Strip internal _count field before returning
      const result = Array.from(aggregated.values()).map(
        ({ _count, ...rest }) => rest
      );

      return Response.json({ data: result });
    }

    // Per-client data: return as-is with formatted dates
    const result = analytics.map((entry) => ({
      date: entry.date.toISOString().split("T")[0],
      totalRequests: entry.totalRequests,
      approvedRequests: entry.approvedRequests,
      rejectedRequests: entry.rejectedRequests,
      averageResponseTime: entry.averageResponseTime,
      clientName: entry.client.name,
    }));

    return Response.json({ data: result });
  } catch (error) {
    console.error("[API /analytics GET] Error:", error);
    return Response.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
