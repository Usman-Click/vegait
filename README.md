<div align="center">

# ⚡ RateFlow

### Rate Limiter as a Service

A High Availability distributed Rate Limiter Service with a beautiful SaaS dashboard, async log processing, Redis-backed token bucket algorithm, and PostgreSQL persistence.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://docker.com)

</div>

---

## Overview

RateFlow sits between client applications and third-party APIs, deciding whether requests should be allowed based on configurable per-client rate limits. It's designed as a real SaaS product — not just a coding exercise.

**Key Features:**

- 🔒 **Token Bucket Algorithm** — Atomic Redis Lua scripts prevent race conditions across distributed instances
- 🛡️ **Failsafe Mode** — Automatic in-memory fallback when Redis goes down. Never blocks all traffic.
- ⚡ **O(1) Request Latency** — Leveraging Next.js 15/16's stable `after()` hook, the rate-check response is sent instantly, deferring Redis queue logs to background microtasks.
- 🏎️ **Client-Credential Caching** — Redis is utilized to cache client limits and API keys with negative caching for invalid keys, eliminating PostgreSQL queries on the request path.
- 📊 **Real-time Dashboard** — Beautiful admin UI with live charts, client management, and health monitoring
- ⚡ **Async Logging** — BullMQ processes request logs without blocking API responses
- 🐳 **Docker Ready** — Full stack runs with a single `docker compose up --build`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Dashboard                       │
│              (React + shadcn/ui + Recharts)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ React Query
┌──────────────────────────▼──────────────────────────────────┐
│                    Next.js API Routes                       │
│                    (Zod validated)                           │
└───────┬──────────────────┬───────────────────┬──────────────┘
        │                  │                   │
   ┌────▼────┐      ┌─────▼──────┐     ┌──────▼──────┐
   │  Rate   │      │  BullMQ    │     │  Prisma     │
   │ Limiter │      │  Queue     │     │  (CRUD)     │
   └────┬────┘      └─────┬──────┘     └──────┬──────┘
        │                  │                   │
   ┌────▼────┐      ┌─────▼──────┐     ┌──────▼──────┐
   │  Redis  │      │  Worker    │     │ PostgreSQL  │
   │ (tokens)│      │  (logs)    │────▶│ (persist)   │
   └─────────┘      └────────────┘     └─────────────┘
```

See [docs/architecture.md](docs/architecture.md) for detailed Mermaid diagrams.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui (New York) |
| Charts | Recharts |
| Data Fetching | React Query (TanStack) |
| Validation | Zod |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Cache / Limiter | Redis 7 (ioredis) |
| Queue | BullMQ |
| Testing | Vitest |
| Containerization | Docker + Docker Compose |

---

## Folder Structure

```
rateflow/
├── prisma/                    # Database schema + seed
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── check/         # POST /api/check
│   │   │   ├── clients/       # CRUD /api/clients
│   │   │   ├── analytics/     # GET /api/analytics
│   │   │   └── health/        # GET /api/health
│   │   └── dashboard/         # Dashboard pages
│   │       ├── clients/
│   │       ├── analytics/
│   │       └── health/
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives
│   │   ├── dashboard/         # Dashboard-specific components
│   │   ├── layout/            # Sidebar, header, mobile nav
│   │   └── providers/         # React Query provider
│   ├── hooks/                 # React Query hooks
│   ├── lib/
│   │   ├── rate-limiter/      # Token bucket + failsafe
│   │   └── validators/        # Zod schemas
│   ├── types/                 # Shared TypeScript types
│   └── workers/               # BullMQ log worker
├── tests/
│   ├── unit/                  # Unit tests
│   └── load/                  # Load + race condition tests
├── docs/                      # Architecture diagrams
├── postman/                   # API collection
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Setup

### Prerequisites

- **Node.js** 20+
- **Docker Desktop** (for Redis + PostgreSQL)
- **npm** 9+

### Quick Start (Docker)

```bash
# 1. Clone the repository
git clone <repo-url> && cd rateflow

# 2. Copy environment variables
cp .env.example .env

# 3. Start everything
docker compose up --build

# 4. Open the dashboard
open http://localhost:3000
```

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Start Redis + PostgreSQL via Docker
docker compose up postgres redis -d

# 4. Generate Prisma client + push schema
npx prisma generate
npx prisma db push

# 5. Seed the database with demo data
npm run db:seed

# 6. Start the development server
npm run dev

# 7. In a separate terminal, start the log worker
npm run worker

# 8. Open the dashboard
open http://localhost:3000
```

---

## Environment Variables

| Variable | Description | Default |
|----------|------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://rateflow:rateflow@localhost:15432/rateflow` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | `development` |

---

## Running Tests

```bash
# Run all tests (unit + load)
npm test

# Run only unit tests
npx vitest run tests/unit/

# Run only load tests
npm run test:load

# Watch mode
npm run test:watch
```

### Test Coverage

| Category | Tests |
|----------|-------|
| Unit | Token bucket, in-memory limiter, rate limiter facade, API key generation |
| Load | Concurrent requests, race conditions, Redis failure simulation, throughput |

---

## API Examples

### Check Rate Limit

```bash
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "rf_your_key_here", "endpoint": "/api/users"}'
```

**Response (200 — Allowed):**
```json
{
  "allowed": true,
  "remaining": 99,
  "retryAfter": 0
}
```

**Response (429 — Rate Limited):**
```json
{
  "allowed": false,
  "remaining": 0,
  "retryAfter": 3
}
```

### Create Client

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "rateLimit": 100, "windowSeconds": 60}'
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "redis": { "status": "healthy", "latency": 1 },
    "database": { "status": "healthy", "latency": 3 },
    "queue": { "status": "healthy", "latency": 2 }
  },
  "rateLimiter": {
    "mode": "redis",
    "degraded": false
  }
}
```

### List Clients

```bash
curl "http://localhost:3000/api/clients?page=1&pageSize=10&search=acme"
```

### Get Analytics

```bash
curl "http://localhost:3000/api/analytics?days=30"
```

---

## Future Improvements

- [ ] **Authentication** — Add JWT/OAuth for dashboard access
- [ ] **WebSocket** — Real-time dashboard updates via WebSocket
- [ ] **Multi-tenancy** — Workspace/organization support
- [ ] **Sliding Window** — Add sliding window log algorithm option
- [ ] **Rate Limit Headers** — Return standard `X-RateLimit-*` headers
- [ ] **Webhook Notifications** — Alert when clients approach their limit
- [ ] **API Gateway Mode** — Proxy requests through RateFlow to target APIs
- [ ] **Geo-distributed** — Redis Cluster support for global deployments
- [ ] **Usage Billing** — Track and bill based on request volume
- [ ] **Audit Log** — Track all admin actions (client CRUD, key rotation)

---

## License

MIT

---

<div align="center">

Built with ⚡ by RateFlow

</div>
# vegait
