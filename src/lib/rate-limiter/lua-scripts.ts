// ==============================================
// RateFlow — Redis Lua Scripts
// Atomic token bucket operations executed server-side in Redis
// ==============================================

/**
 * Token Bucket Lua Script
 *
 * This script runs atomically on Redis, ensuring no race conditions
 * even when multiple RateFlow instances share the same Redis.
 *
 * Algorithm:
 * 1. Load the current bucket state (tokens + last_refill timestamp)
 * 2. Calculate how many tokens to add based on elapsed time
 * 3. Cap tokens at the maximum (rateLimit)
 * 4. If tokens >= 1, consume one and allow the request
 * 5. If tokens < 1, reject and calculate retry-after
 *
 * KEYS[1] = bucket key (e.g., "rateflow:bucket:<clientId>")
 * ARGV[1] = max tokens (rateLimit)
 * ARGV[2] = window in seconds (windowSeconds)
 * ARGV[3] = current timestamp in seconds (float)
 *
 * Returns: [allowed (0|1), remaining tokens, retry_after seconds]
 */
export const TOKEN_BUCKET_SCRIPT = `
  local key = KEYS[1]
  local max_tokens = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  -- Calculate refill rate: tokens per second
  local refill_rate = max_tokens / window

  -- Get current bucket state
  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  -- Initialize bucket if it doesn't exist
  if tokens == nil then
    tokens = max_tokens
    last_refill = now
  end

  -- Calculate token refill based on elapsed time
  local elapsed = now - last_refill
  local new_tokens = elapsed * refill_rate
  tokens = math.min(max_tokens, tokens + new_tokens)
  last_refill = now

  local allowed = 0
  local retry_after = 0

  if tokens >= 1 then
    -- Consume one token and allow the request
    tokens = tokens - 1
    allowed = 1
  else
    -- Calculate time until one token is available
    retry_after = (1 - tokens) / refill_rate
  end

  -- Persist the updated bucket state with TTL
  redis.call('HSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(last_refill))
  redis.call('EXPIRE', key, window * 2)

  -- Return: [allowed, remaining, retry_after]
  return {allowed, math.floor(tokens), math.ceil(retry_after)}
`;
