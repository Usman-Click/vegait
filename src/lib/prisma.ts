// ==============================================
// RateFlow — Prisma Client Singleton
// Prevents multiple Prisma Client instances in development
// ==============================================

import { PrismaClient } from "@prisma/client";

/**
 * Global singleton pattern for Prisma Client.
 * In development, Next.js hot-reloads modules which would create
 * new PrismaClient instances. We store the client on globalThis
 * to reuse it across reloads.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
