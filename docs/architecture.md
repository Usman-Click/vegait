# RateFlow — Architecture Documentation

## System Overview

RateFlow is a High Availability distributed Rate Limiter Service that sits between client applications and third-party APIs. It decides whether requests should be allowed based on configurable per-client rate limits.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        A["Next.js Dashboard<br/>(React + shadcn/ui + Recharts)"]
    end

    subgraph "API Layer"
        B["Next.js API Routes<br/>(Zod validated)"]
    end

    subgraph "Rate Limiter Core"
        C["Token Bucket Algorithm<br/>(Atomic Lua scripts)"]
        D["In-Memory Fallback<br/>(Failsafe mode)"]
    end

    subgraph "Async Processing"
        E["BullMQ Queue<br/>(request-logs)"]
        F["BullMQ Worker<br/>(standalone process)"]
    end

    subgraph "Data Stores"
        G[("Redis 7<br/>Token counters")]
        H[("PostgreSQL 16<br/>Persistent data")]
    end

    A -->|"React Query"| B
    B -->|"Rate check"| C
    C -->|"Connection error"| D
    C -->|"Lua eval"| G
    B -->|"Enqueue log"| E
    E -->|"Process job"| F
    F -->|"Prisma tx"| H
    B -->|"CRUD queries"| H
```

## Token Bucket Algorithm

The token bucket is a rate limiting algorithm that:

1. Each client has a "bucket" with a maximum number of tokens
2. Tokens are consumed on each request (1 token per request)
3. Tokens refill at a constant rate: `maxTokens / windowSeconds` per second
4. If the bucket has >= 1 token, the request is allowed
5. If the bucket is empty, the request is rejected with a `retryAfter` value

### Why Token Bucket?

- **Smooth rate limiting**: Unlike fixed windows, token bucket allows bursts up to the limit
- **No boundary issues**: No sudden resets at window boundaries
- **Atomic operations**: Lua script runs entirely inside Redis — no race conditions

### Lua Script Flow

```mermaid
flowchart TD
    A["Request arrives"] --> B["Load bucket state from Redis"]
    B --> C{"Bucket exists?"}
    C -->|No| D["Initialize with max tokens"]
    C -->|Yes| E["Calculate elapsed time"]
    D --> E
    E --> F["Refill tokens: elapsed × refillRate"]
    F --> G["Cap at maxTokens"]
    G --> H{"tokens >= 1?"}
    H -->|Yes| I["Consume 1 token → ALLOWED"]
    H -->|No| J["Calculate retryAfter → REJECTED"]
    I --> K["Persist state + set TTL"]
    J --> K
```

## Failsafe Architecture

```mermaid
sequenceDiagram
    participant API as API Route
    participant RL as RateLimiter Facade
    participant Redis
    participant Mem as In-Memory Fallback

    API->>RL: check(clientId, limit, window)
    RL->>Redis: eval(lua_script, ...)
    
    alt Redis Available
        Redis-->>RL: [allowed, remaining, retryAfter]
        RL-->>API: RateLimitResult
    else Redis Down
        Redis--xRL: Connection Error
        RL->>Mem: check(clientId, limit, window)
        Mem-->>RL: RateLimitResult (degraded)
        RL-->>API: RateLimitResult
        Note over RL: Sets degraded = true
    end
    
    Note over API: /api/health reports degraded mode
```

## ER Diagram

```mermaid
erDiagram
    Client ||--o{ RequestLog : "has many"
    Client ||--o{ Analytics : "has many"
    Client ||--o{ ApiKey : "has many"

    Client {
        string id PK "cuid"
        string name
        string apiKey UK "Primary key (legacy)"
        int rateLimit "Max requests per window"
        int windowSeconds "Window duration"
        boolean active
        datetime createdAt
        datetime updatedAt
    }

    RequestLog {
        string id PK "cuid"
        string clientId FK
        string endpoint
        boolean allowed
        float responseTime "milliseconds"
        datetime timestamp
    }

    Analytics {
        string id PK "cuid"
        string clientId FK
        int totalRequests
        int approvedRequests
        int rejectedRequests
        float averageResponseTime
        date date "Day granularity"
    }

    ApiKey {
        string id PK "cuid"
        string clientId FK
        string key UK "rf_xxx format"
        boolean active
        datetime createdAt
    }
```

## Async Log Processing

```mermaid
sequenceDiagram
    participant API as POST /api/check
    participant Queue as BullMQ Queue
    participant Worker as Log Worker
    participant DB as PostgreSQL

    API->>Queue: enqueueLog(data)
    Note over API: Returns immediately<br/>Never blocks response

    Queue->>Worker: Job picked up
    Worker->>DB: BEGIN TRANSACTION
    Worker->>DB: INSERT RequestLog
    Worker->>DB: UPSERT Analytics (daily aggregate)
    Worker->>DB: COMMIT

    Note over Worker: Retries up to 3x on failure<br/>Exponential backoff
```
