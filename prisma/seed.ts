// ==============================================
// RateFlow — Database Seed Script
// Populates the database with demo data
// Run: npm run db:seed
// ==============================================

import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

/** Generates an API key in the rf_ format */
function makeApiKey(): string {
  return `rf_${randomBytes(16).toString("hex")}`;
}

/** Returns a random number between min and max (inclusive) */
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clean existing data
  await prisma.requestLog.deleteMany();
  await prisma.analytics.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.client.deleteMany();

  // ---- Create demo clients ----
  const clientConfigs = [
    { name: "Acme Corp", rateLimit: 100, windowSeconds: 60 },
    { name: "Globex Inc", rateLimit: 1000, windowSeconds: 60 },
    { name: "Initech", rateLimit: 5000, windowSeconds: 60 },
    { name: "Umbrella Corp", rateLimit: 500, windowSeconds: 60 },
    { name: "Stark Industries", rateLimit: 2000, windowSeconds: 60 },
  ];

  const clients = [];

  for (const config of clientConfigs) {
    const apiKey = makeApiKey();
    const client = await prisma.client.create({
      data: {
        name: config.name,
        apiKey,
        rateLimit: config.rateLimit,
        windowSeconds: config.windowSeconds,
        active: true,
      },
    });

    // Create matching ApiKey record
    await prisma.apiKey.create({
      data: {
        clientId: client.id,
        key: apiKey,
        active: true,
      },
    });

    clients.push(client);
    console.log(`  ✓ Client: ${client.name} (${apiKey.slice(0, 16)}...)`);
  }

  // ---- Seed 30 days of analytics ----
  console.log("\n  Seeding analytics...");

  for (const client of clients) {
    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(0, 0, 0, 0);

      const totalRequests = rand(50, client.rateLimit * 2);
      const rejectedPct = Math.random() * 0.15; // 0-15% rejection rate
      const rejectedRequests = Math.floor(totalRequests * rejectedPct);
      const approvedRequests = totalRequests - rejectedRequests;

      await prisma.analytics.create({
        data: {
          clientId: client.id,
          date,
          totalRequests,
          approvedRequests,
          rejectedRequests,
          averageResponseTime: parseFloat((Math.random() * 15 + 2).toFixed(2)),
        },
      });
    }
  }

  console.log("  ✓ 30 days of analytics seeded for each client");

  // ---- Seed some recent request logs ----
  console.log("  Seeding request logs...");

  const endpoints = ["/api/users", "/api/products", "/api/orders", "/api/search", "/api/auth"];

  for (const client of clients) {
    const logEntries = [];
    for (let i = 0; i < 50; i++) {
      const minutesAgo = rand(0, 1440); // Last 24 hours
      const timestamp = new Date();
      timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);

      logEntries.push({
        clientId: client.id,
        endpoint: endpoints[rand(0, endpoints.length - 1)],
        allowed: Math.random() > 0.1, // 90% allowed
        responseTime: parseFloat((Math.random() * 20 + 1).toFixed(2)),
        timestamp,
      });
    }

    await prisma.requestLog.createMany({ data: logEntries });
  }

  console.log("  ✓ 250 request logs seeded\n");

  // ---- Print summary ----
  const clientCount = await prisma.client.count();
  const analyticsCount = await prisma.analytics.count();
  const logCount = await prisma.requestLog.count();
  const keyCount = await prisma.apiKey.count();

  console.log("📊 Seed summary:");
  console.log(`   Clients:      ${clientCount}`);
  console.log(`   API Keys:     ${keyCount}`);
  console.log(`   Analytics:    ${analyticsCount}`);
  console.log(`   Request Logs: ${logCount}`);
  console.log("\n✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
