// lib/api-keys.ts
// Server-only. Never import this from a "use client" component —
// it uses Node's crypto module and must run in an API route.

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const KEY_BYTES = 32; // 256 bits of entropy

/**
 * Generates a new API key. The raw key is returned exactly once —
 * callers must show it to the user immediately and never store it.
 * Only the hash + prefix should be persisted.
 */
export function generateApiKey(provider: string = "krypton"): {
  rawKey: string;
  hashedKey: string;
  keyPrefix: string;
} {
  const random = crypto.randomBytes(KEY_BYTES).toString("base64url");
  const rawKey = `krp_${provider}_${random}`;
  const hashedKey = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 16); // safe, non-reversible display prefix

  return { rawKey, hashedKey, keyPrefix };
}

/** SHA-256 hash of a raw key — this is what gets stored and compared. */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Verifies a raw API key presented by a client against user_api_keys.
 * Checks status + expiry, and atomically records usage. Intended for
 * any future public Krypton API endpoint that wants to accept
 * key-based auth (no such endpoint exists yet — this is the reusable
 * middleware ready for one). Returns the owning user_id on success,
 * or null if the key is missing, revoked, or expired.
 */
export async function verifyApiKey(
  db: SupabaseClient,
  rawKey: string,
  requestIp?: string
): Promise<{ userId: string; keyId: string } | null> {
  if (!rawKey || !rawKey.startsWith("krp_")) return null;

  const hashedKey = hashApiKey(rawKey);
  const { data: key } = await db
    .from("user_api_keys")
    .select("id, user_id, status, expires_at")
    .eq("hashed_key", hashedKey)
    .maybeSingle();

  if (!key || key.status !== "active") return null;
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) return null;

  // Best-effort usage tracking — must never block the caller's request.
  db.from("user_api_keys")
    .update({
      last_used_at: new Date().toISOString(),
      last_used_ip: requestIp || null,
    })
    .eq("id", key.id)
    .then(() => {}, () => {});

  // Atomic increment via Postgres function avoids a lost-update race
  // under concurrent requests (two increments overwriting each other).
  db.rpc("increment_api_key_usage", { key_id: key.id }).then(() => {}, () => {});

  return { userId: key.user_id, keyId: key.id };
}

