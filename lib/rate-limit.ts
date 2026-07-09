// lib/rate-limit.ts
// Distributed rate limiting via Upstash Redis (REST-based — works from
// any serverless runtime, no persistent connection, survives cold starts).
//
// This is the ONE place rate-limit logic lives. lib/api-security.ts's
// rateLimit() delegates here so every existing caller (all under
// app/api/settings/* and app/api/admin/*) keeps working unchanged
// except for adding `await` — no duplicate limiting logic anywhere else.

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let redisClient: Redis | null = null;
let redisInitAttempted = false;

function getRedis(): Redis | null {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // not configured — caller falls back

  redisClient = new Redis({ url, token });
  return redisClient;
}

// One Ratelimit instance per (limit, window) pair, reused across
// invocations within the same warm instance — cheap to keep, avoids
// reconstructing the sliding-window config on every call.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number, redis: Redis): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: "krypton-ratelimit",
  });
  limiterCache.set(cacheKey, rl);
  return rl;
}

// Per-instance fallback ONLY used when Upstash env vars aren't set
// (e.g. local development). This does NOT provide a global limit across
// Vercel instances — set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// in production for real distributed enforcement.
const memoryFallback = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = memoryFallback.get(key);
  if (!entry || now > entry.resetAt) {
    memoryFallback.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

export async function distributedRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  if (!redis) return memoryRateLimit(key, limit, windowMs);

  try {
    const limiter = getLimiter(limit, windowMs, redis);
    const result = await limiter.limit(key);
    return { allowed: result.success, remaining: result.remaining };
  } catch {
    // Redis unreachable — fail OPEN for rate limiting specifically (a
    // transient Redis outage should not take down all API traffic).
    // Auth/authorization checks elsewhere always fail closed; this
    // tradeoff applies only to this abuse-prevention layer.
    return { allowed: true, remaining: limit };
  }
}

