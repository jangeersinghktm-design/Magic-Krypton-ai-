// lib/generation-lock.ts
// Distributed "one generation at a time per user" lock. Replaces the
// module-level `activeGenerations = new Set<string>()` that used to live
// in app/api/orchestrate/route.ts — that Set only worked within a single
// warm serverless instance; this works across all instances/regions via
// the same Redis connection already used by lib/rate-limit.ts.

import { getRedis } from "./rate-limit";

const LOCK_PREFIX = "krypton-genlock:";

// Per-instance fallback ONLY when Upstash env vars aren't configured
// (e.g. local dev). Same honest limitation as rate-limit.ts's fallback —
// not a global lock in that case, just better than nothing.
const memoryLocks = new Map<string, number>();

function memoryAcquire(key: string, ttlMs: number): boolean {
  const now = Date.now();
  const expiresAt = memoryLocks.get(key);
  if (expiresAt && now < expiresAt) return false;
  memoryLocks.set(key, now + ttlMs);
  return true;
}

/**
 * Attempts to acquire the generation lock for a user. Returns true if
 * acquired (caller may proceed), false if another generation is already
 * in flight for this user. TTL is a safety net in case release() is
 * never called (e.g. function crash) — the lock self-expires.
 */
export async function acquireGenerationLock(userId: string, ttlSeconds = 300): Promise<boolean> {
  const key = `${LOCK_PREFIX}${userId}`;
  const redis = getRedis();

  if (!redis) return memoryAcquire(key, ttlSeconds * 1000);

  try {
    // SET key value NX EX ttl — atomic "set only if not already set".
    const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
    return result === "OK";
  } catch {
    // Redis unreachable — fail OPEN for this specific guard. A transient
    // Redis outage should not block all generations; worst case here is
    // the rare double-generation this lock exists to prevent, which is
    // a much smaller harm than a full outage of the core product.
    return true;
  }
}

/** Releases the lock — call this whenever a generation finishes, succeeds, or errors. */
export async function releaseGenerationLock(userId: string): Promise<void> {
  const key = `${LOCK_PREFIX}${userId}`;
  const redis = getRedis();

  if (!redis) { memoryLocks.delete(key); return; }
  try { await redis.del(key); } catch {}
}

