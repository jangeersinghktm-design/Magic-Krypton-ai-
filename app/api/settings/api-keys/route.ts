// app/api/settings/api-keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateApiKey } from "@/lib/api-keys";
import { rateLimit } from "@/lib/api-security";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

const MAX_EXPIRY_DAYS = 3650; // 10 years — sanity ceiling, not a real-world limit

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUser(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await admin().auth.getUser(token);
  return user;
}

// ── GET — list keys (never returns hashed_key) ─────────────────────
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`api-key-list:${user.id}`, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const { data, error } = await admin()
    .from("user_api_keys")
    .select("id, name, key_prefix, provider, status, expires_at, usage_count, last_used_at, last_used_ip, created_at, created_by, revoked_at, revoked_by, revoke_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data || [] });
}

// ── POST — create a new key (raw key returned exactly once) ────────
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`api-key-create:${user.id}`, 5, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many key creations. Try again in a minute." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name || "").toString().trim().slice(0, 60);
  const provider = (body?.provider || "krypton").toString().trim().slice(0, 30);
  if (!name) return NextResponse.json({ error: "Key name is required." }, { status: 400 });

  let expiresAt: string | null = null;
  if (body?.expiresInDays !== undefined && body?.expiresInDays !== null) {
    const days = Number(body.expiresInDays);
    if (!Number.isFinite(days) || days < 1 || days > MAX_EXPIRY_DAYS) {
      return NextResponse.json({ error: `expiresInDays must be between 1 and ${MAX_EXPIRY_DAYS}.` }, { status: 400 });
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  const { rawKey, hashedKey, keyPrefix } = generateApiKey(provider);
  const db = admin();

  const { data, error } = await db
    .from("user_api_keys")
    .insert({ user_id: user.id, name, hashed_key: hashedKey, key_prefix: keyPrefix, provider, expires_at: expiresAt, created_by: user.id })
    .select("id, name, key_prefix, provider, status, expires_at, usage_count, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(db, {
    userId: user.id, action: "api_key.created",
    targetTable: "user_api_keys", targetId: data.id,
    metadata: { name, provider, key_prefix: keyPrefix, expires_at: expiresAt },
    req,
  });

  // rawKey is returned exactly once — the client must show it now and discard it.
  return NextResponse.json({ key: data, rawKey });
}

// ── DELETE — revoke a key (?id=...) ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`api-key-revoke:${user.id}`, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing key id." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const revokeReason = (body?.reason || "").toString().trim().slice(0, 200) || null;

  const db = admin();
  const { error } = await db
    .from("user_api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user.id, revoke_reason: revokeReason })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(db, {
    userId: user.id, action: "api_key.revoked",
    targetTable: "user_api_keys", targetId: id,
    metadata: { revoke_reason: revokeReason },
    req,
  });

  return NextResponse.json({ success: true });
}

