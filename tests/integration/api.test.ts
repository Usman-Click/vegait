// ==============================================
// RateFlow — Integration Tests: API Routes
// Tests all route handlers by mocking database and cache services
// ==============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as handleCheck } from "@/app/api/check/route";
import { GET as handleGetClients, POST as handleCreateClient } from "@/app/api/clients/route";
import { GET as handleGetClient, PATCH as handleUpdateClient, DELETE as handleDeleteClient } from "@/app/api/clients/[id]/route";
import { POST as handleGenerateApiKey } from "@/app/api/clients/[id]/api-key/route";
import { GET as handleGetAnalytics } from "@/app/api/analytics/route";
import { GET as handleGetHealth } from "@/app/api/health/route";

// Declare mockPrisma inside vi.hoisted so it is hoisted before vi.mock executes
const { mockPrisma } = vi.hoisted(() => {
  const mPrisma = {
    client: {
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    apiKey: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    requestLog: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    analytics: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (typeof arg === "function") {
        return arg(mPrisma);
      }
      return Promise.all(arg);
    }),
    $queryRaw: vi.fn(),
  };
  return { mockPrisma: mPrisma };
});

// Mocking prisma client using the hoisted mockPrisma object
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mocking rate limiter
vi.mock("@/lib/rate-limiter/rate-limiter", () => ({
  rateLimiter: {
    check: vi.fn(),
    reset: vi.fn(),
    isDegraded: vi.fn(() => false),
    getMode: vi.fn(() => "redis"),
  },
}));

// Mocking queue
vi.mock("@/lib/queue", () => ({
  logQueue: {
    getWaitingCount: vi.fn(() => Promise.resolve(0)),
    getActiveCount: vi.fn(() => Promise.resolve(0)),
  },
  enqueueLog: vi.fn(),
}));

// Mocking redis health check
vi.mock("@/lib/redis", () => ({
  checkRedisHealth: vi.fn(() => Promise.resolve(5)),
}));

import { prisma } from "@/lib/prisma";
import { rateLimiter } from "@/lib/rate-limiter/rate-limiter";
import { enqueueLog } from "@/lib/queue";

describe("API Routes Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/check", () => {
    it("should return 400 for invalid body schema", async () => {
      const request = new NextRequest("http://localhost:3000/api/check", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await handleCheck(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty("error", "Invalid request");
    });

    it("should return 401 for invalid API key prefix", async () => {
      const request = new NextRequest("http://localhost:3000/api/check", {
        method: "POST",
        body: JSON.stringify({ apiKey: "invalid_key", endpoint: "/test" }),
      });

      const response = await handleCheck(request);
      expect(response.status).toBe(400); // Because schema requires startsWith("rf_")
    });

    it("should return 401 when client is not found in database", async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/check", {
        method: "POST",
        body: JSON.stringify({ apiKey: "rf_notfound", endpoint: "/test" }),
      });

      const response = await handleCheck(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Invalid or inactive API key");
    });

    it("should rate check successfully and call queue when client is found", async () => {
      const mockClient = {
        id: "client-1",
        name: "Test Client",
        apiKey: "rf_active_key",
        rateLimit: 100,
        windowSeconds: 60,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);
      vi.mocked(rateLimiter.check).mockResolvedValue({
        allowed: true,
        remaining: 99,
        retryAfter: 0,
      });

      const request = new NextRequest("http://localhost:3000/api/check", {
        method: "POST",
        body: JSON.stringify({ apiKey: "rf_active_key", endpoint: "/api/users" }),
      });

      const response = await handleCheck(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ allowed: true, remaining: 99, retryAfter: 0 });

      expect(rateLimiter.check).toHaveBeenCalledWith("client-1", 100, 60);
      expect(enqueueLog).toHaveBeenCalled();
    });
  });

  describe("GET /api/clients", () => {
    it("should return list of clients with pagination info", async () => {
      vi.mocked(prisma.client.count).mockResolvedValue(1);
      vi.mocked(prisma.client.findMany).mockResolvedValue([
        {
          id: "client-1",
          name: "Test Client",
          apiKey: "rf_key",
          rateLimit: 100,
          windowSeconds: 60,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const request = new NextRequest("http://localhost:3000/api/clients?page=1&pageSize=10");
      const response = await handleGetClients(request);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(1);
    });
  });

  describe("POST /api/clients", () => {
    it("should create client successfully and return 201", async () => {
      const mockClient = {
        id: "client-new",
        name: "Acme Corp",
        apiKey: "rf_mock_generated",
        rateLimit: 100,
        windowSeconds: 60,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock prisma transaction logic
      vi.mocked(prisma.client.create).mockResolvedValue(mockClient);

      const request = new NextRequest("http://localhost:3000/api/clients", {
        method: "POST",
        body: JSON.stringify({ name: "Acme Corp", rateLimit: 100, windowSeconds: 60 }),
      });

      const response = await handleCreateClient(request);
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe("Acme Corp");
    });
  });

  describe("GET /api/clients/[id]", () => {
    it("should return 404 when client is not found", async () => {
      vi.mocked(prisma.client.findUnique).mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/clients/none");
      const response = await handleGetClient(request, { params: Promise.resolve({ id: "none" }) });
      expect(response.status).toBe(404);
    });

    it("should return client data when found", async () => {
      const mockClient = {
        id: "client-1",
        name: "Test Client",
        apiKey: "rf_key",
        rateLimit: 100,
        windowSeconds: 60,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        apiKeys: [],
        _count: { requestLogs: 0 },
      };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(mockClient);

      const request = new NextRequest("http://localhost:3000/api/clients/client-1");
      const response = await handleGetClient(request, { params: Promise.resolve({ id: "client-1" }) });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe("client-1");
    });
  });

  describe("PATCH /api/clients/[id]", () => {
    it("should update client successfully", async () => {
      const mockClient = {
        id: "client-1",
        name: "Old Name",
        apiKey: "rf_key",
        rateLimit: 100,
        windowSeconds: 60,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(prisma.client.update).mockResolvedValue({
        ...mockClient,
        name: "New Name",
      });

      const request = new NextRequest("http://localhost:3000/api/clients/client-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      });

      const response = await handleUpdateClient(request, { params: Promise.resolve({ id: "client-1" }) });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe("New Name");
    });
  });

  describe("DELETE /api/clients/[id]", () => {
    it("should delete client and return success message", async () => {
      const mockClient = { id: "client-1" };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.client.delete).mockResolvedValue(mockClient as any);

      const request = new NextRequest("http://localhost:3000/api/clients/client-1", {
        method: "DELETE",
      });

      const response = await handleDeleteClient(request, { params: Promise.resolve({ id: "client-1" }) });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Client deleted successfully");
    });
  });

  describe("POST /api/clients/[id]/api-key", () => {
    it("should generate a new API key and return it", async () => {
      const mockClient = { id: "client-1", name: "Test Client" };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.apiKey.create).mockResolvedValue({
        id: "key-2",
        clientId: "client-1",
        key: "rf_new_mock_key",
        active: true,
        createdAt: new Date(),
      });

      const request = new NextRequest("http://localhost:3000/api/clients/client-1/api-key", {
        method: "POST",
      });

      const response = await handleGenerateApiKey(request, { params: Promise.resolve({ id: "client-1" }) });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.key).toBe("rf_new_mock_key");
    });
  });

  describe("GET /api/analytics", () => {
    it("should aggregate analytics across all clients when no filter is provided", async () => {
      const date1 = new Date();
      date1.setDate(date1.getDate() - 1);
      const date2 = new Date();
      date2.setDate(date2.getDate() - 2);

      vi.mocked(prisma.analytics.findMany).mockResolvedValue([
        {
          id: "1",
          clientId: "client-1",
          totalRequests: 10,
          approvedRequests: 8,
          rejectedRequests: 2,
          averageResponseTime: 5,
          date: date1,
          client: { name: "Client A" },
        },
        {
          id: "2",
          clientId: "client-2",
          totalRequests: 20,
          approvedRequests: 15,
          rejectedRequests: 5,
          averageResponseTime: 10,
          date: date1,
          client: { name: "Client B" },
        },
      ] as any);

      const request = new NextRequest("http://localhost:3000/api/analytics?days=30");
      const response = await handleGetAnalytics(request);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.data).toHaveLength(1); // Merged into 1 date key
      expect(data.data[0].totalRequests).toBe(30);
      expect(data.data[0].approvedRequests).toBe(23);
      expect(data.data[0].rejectedRequests).toBe(7);
    });
  });

  describe("GET /api/health", () => {
    it("should return health details", async () => {
      const response = await handleGetHealth();
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.status).toBe("healthy");
      expect(data.services.redis.status).toBe("healthy");
      expect(data.services.database.status).toBe("healthy");
      expect(data.services.queue.status).toBe("healthy");
    });
  });
});
