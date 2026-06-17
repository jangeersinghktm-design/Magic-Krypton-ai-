"use client";
// app/debug-test/page.tsx — Krypton AI Production Operations Center

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  bg: "#050505", surface: "#0A0A0A", card: "#0D0D0D", card2: "#111",
  border: "rgba(255,255,255,0.07)", borderGold: "rgba(245,216,0,0.2)",
  gold: "#F5D800", green: "#10B981", red: "#EF4444", orange: "#F59E0B",
  blue: "#3B82F6", purple: "#8B5CF6", text: "#fff", muted: "#6B7280", muted2: "#4B5563",
};

type Status = "idle" | "running" | "pass" | "warn" | "fail" | "skip";

interface Check {
  id: string;
  label: string;
  status: Status;
  value?: string;
  latency?: number;
  detail?: string;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  checks: Check[];
  score?: number;
}

// ── Helpers ───────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const STATUS_COLOR: Record<Status, string> = {
  idle: C.muted, running: C.gold, pass: C.green, warn: C.orange, fail: C.red, skip: C.muted2,
};
const STATUS_ICON: Record<Status, string> = {
  idle: "○", running: "◌", pass: "✓", warn: "⚠", fail: "✗", skip: "—",
};

function sectionScore(checks: Check[]): number {
  const tested = checks.filter(c => c.status !== "idle" && c.status !== "skip");
  if (!tested.length) return 0;
  const pts = tested.reduce((s, c) => s + (c.status === "pass" ? 10 : c.status === "warn" ? 6 : 0), 0);
  return Math.round((pts / (tested.length * 10)) * 100);
}

// ── INITIAL SECTIONS TEMPLATE ─────────────────────────────────────
function buildSections(): Section[] {
  return [
    {
      id: "system", icon: "🗄️", title: "System Health",
      checks: [
        { id: "db_conn",    label: "Supabase Connection",   status: "idle" },
        { id: "db_lat",     label: "Database Latency",      status: "idle" },
        { id: "auth_svc",   label: "Auth Service",          status: "idle" },
        { id: "svc_role",   label: "Service Role Access",   status: "idle" },
        { id: "env_vars",   label: "Environment Variables", status: "idle" },
        { id: "rls",        label: "RLS & Table Access",    status: "idle" },
        { id: "mig",        label: "Migration Status",      status: "idle" },
      ],
    },
    {
      id: "providers", icon: "🤖", title: "AI Providers",
      checks: [
        { id: "claude",     label: "Claude (Anthropic)",    status: "idle" },
        { id: "openai",     label: "OpenAI GPT-4o-mini",    status: "idle" },
        { id: "gemini",     label: "Google Gemini",         status: "idle" },
      ],
    },
    {
      id: "fallback", icon: "🔄", title: "Fallback Chain",
      checks: [
        { id: "fb_claude",  label: "Step 1 → Claude",       status: "idle" },
        { id: "fb_openai",  label: "Step 2 → OpenAI",       status: "idle" },
        { id: "fb_gemini",  label: "Step 3 → Gemini",       status: "idle" },
        { id: "fb_chain",   label: "Chain Execution",       status: "idle" },
      ],
    },
    {
      id: "ai_eng", icon: "🛠️", title: "AI Engineer Health",
      checks: [
        { id: "aie_sess",   label: "Session Creation",      status: "idle" },
        { id: "aie_mem",    label: "Memory Retrieval",      status: "idle" },
        { id: "aie_hist",   label: "Historical Context",    status: "idle" },
        { id: "aie_patch",  label: "Patch Proposal Engine", status: "idle" },
        { id: "aie_appr",   label: "Approval Workflow",     status: "idle" },
        { id: "aie_audit",  label: "Audit Logging",         status: "idle" },
        { id: "aie_roll",   label: "Rollback Workflow",     status: "idle" },
      ],
    },
    {
      id: "memory", icon: "🧠", title: "Memory System",
      checks: [
        { id: "mem_table",  label: "ai_engineer_memory table", status: "idle" },
        { id: "mem_ret",    label: "Memory Retrieval",      status: "idle" },
        { id: "mem_conf",   label: "Confidence Scoring",    status: "idle" },
        { id: "mem_pat",    label: "Issue Pattern Matching", status: "idle" },
        { id: "mem_stats",  label: "Memory Statistics",     status: "idle" },
      ],
    },
    {
      id: "credits", icon: "⚡", title: "Credits System",
      checks: [
        { id: "cr_bal",     label: "Credit Balance",        status: "idle" },
        { id: "cr_plan",    label: "Plan & Limits",         status: "idle" },
        { id: "cr_reset",   label: "Daily Reset",           status: "idle" },
        { id: "cr_trans",   label: "Transactions Table",    status: "idle" },
      ],
    },
    {
      id: "vercel", icon: "▲", title: "Vercel Deployment",
      checks: [
        { id: "vc_token",   label: "Vercel Token",          status: "idle" },
        { id: "vc_api",     label: "Vercel API Reachable",  status: "idle" },
        { id: "vc_last",    label: "Last Deployment",       status: "idle" },
      ],
    },
    {
      id: "security", icon: "🔐", title: "Security",
      checks: [
        { id: "sec_admin",  label: "Admin Role System",     status: "idle" },
        { id: "sec_jwt",    label: "JWT Validation",        status: "idle" },
        { id: "sec_svc",    label: "Service Role Key",      status: "idle" },
        { id: "sec_save",   label: "Project Save (Auth)",   status: "idle" },
      ],
    },
    {
      id: "monitoring", icon: "📊", title: "24h Monitoring",
      checks: [
        { id: "mon_gen",    label: "Generation Logs",       status: "idle" },
        { id: "mon_fail",   label: "Last 24h Failures",     status: "idle" },
        { id: "mon_aie",    label: "AI Engineer Sessions",  status: "idle" },
        { id: "mon_dep",    label: "Deployments",           status: "idle" },
      ],
    },
  ];
}

// ── Main Component ────────────────────────────────────────────────
export default function OpsCenter() {
  const supabase = createClient();
  const router   = useRouter();

  const [allowed,   setAllowed]   = useState(false);
  const [sections,  setSections]  = useState<Section[]>(buildSections());
  const [running,   setRunning]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [score,     setScore]     = useState(0);
  const [token,     setToken]     = useState("");
  const [userId,    setUserId]    = useState("");

  // Admin check
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (p?.role !== "admin") { router.push("/dashboard"); return; }
      setToken(session.access_token);
      setUserId(session.user.id);
      setAllowed(true);
    })();
  }, []);

  // Update a single check
  const upd = useCallback((sectionId: string, checkId: string, patch: Partial<Check>) => {
    setSections(prev => prev.map(s =>
      s.id !== sectionId ? s : {
        ...s,
        checks: s.checks.map(c => c.id !== checkId ? c : { ...c, ...patch }),
      }
    ));
  }, []);

  // Run all checks
  async function runAll() {
    setRunning(true);
    setDone(false);
    setSections(buildSections().map(s => ({
      ...s,
      checks: s.checks.map(c => ({ ...c, status: "idle" as Status })),
    })));

    // ── SECTION 1: SYSTEM HEALTH ──────────────────────────────
    upd("system", "db_conn", { status: "running", label: "Supabase Connection" });
    const t1 = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const lat = Date.now() - t1;
      if (error) throw error;
      upd("system", "db_conn", { status: "pass", value: "Connected", latency: lat });
      upd("system", "db_lat", { status: lat < 300 ? "pass" : lat < 800 ? "warn" : "fail", value: `${lat}ms`, latency: lat });
    } catch (e: any) {
      upd("system", "db_conn", { status: "fail", detail: e.message });
      upd("system", "db_lat", { status: "skip", value: "N/A" });
    }

    upd("system", "auth_svc", { status: "running" });
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      upd("system", "auth_svc", error ? { status: "fail", detail: error.message } : { status: "pass", value: user?.email });
    } catch (e: any) {
      upd("system", "auth_svc", { status: "fail", detail: e.message });
    }

    upd("system", "svc_role", { status: "running" });
    try {
      const res = await fetch("/api/debug-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: token }) });
      const j = await res.json();
      upd("system", "svc_role", j.step === "SUCCESS"
        ? { status: "pass", value: "Service role write OK" }
        : { status: "fail", detail: j.error });
    } catch (e: any) {
      upd("system", "svc_role", { status: "fail", detail: e.message });
    }

    upd("system", "env_vars", { status: "running" });
    const envRes = await fetch("/api/test-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "env_check", accessToken: token }) });
    const envJ = await envRes.json().catch(() => ({}));
    const missingEnv = envJ.missing || [];
    upd("system", "env_vars", missingEnv.length === 0
      ? { status: "pass", value: "All keys present" }
      : { status: "fail", detail: `Missing: ${missingEnv.join(", ")}` });

    upd("system", "rls", { status: "running" });
    try {
      const { error: e1 } = await supabase.from("projects").select("id").limit(1);
      const { error: e2 } = await supabase.from("profiles").select("id").limit(1);
      const fail = [e1, e2].filter(Boolean);
      upd("system", "rls", fail.length === 0
        ? { status: "pass", value: "profiles + projects readable" }
        : { status: "warn", detail: fail.map(e => e?.message).join("; ") });
    } catch (e: any) {
      upd("system", "rls", { status: "fail", detail: e.message });
    }

    upd("system", "mig", { status: "running" });
    try {
      const tables = ["profiles", "projects", "credit_transactions", "generation_logs", "ai_engineer_sessions", "ai_engineer_memory"];
      const results = await Promise.all(tables.map(t => supabase.from(t).select("id").limit(1)));
      const missing = tables.filter((_, i) => results[i].error);
      upd("system", "mig", missing.length === 0
        ? { status: "pass", value: `${tables.length} tables verified` }
        : { status: "fail", detail: `Missing: ${missing.join(", ")}` });
    } catch (e: any) {
      upd("system", "mig", { status: "fail", detail: e.message });
    }

    await delay(200);

    // ── SECTION 2: AI PROVIDERS ───────────────────────────────
    for (const p of [
      { id: "claude", label: "Claude", key: "claude" },
      { id: "openai", label: "OpenAI", key: "openai" },
      { id: "gemini", label: "Gemini", key: "gemini" },
    ]) {
      upd("providers", p.id, { status: "running" });
      const t = Date.now();
      try {
        const res = await fetch("/api/test-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: p.key, accessToken: token }) });
        const j = await res.json();
        const lat = Date.now() - t;
        upd("providers", p.id, j.ok
          ? { status: "pass", value: j.message, latency: lat }
          : { status: "fail", detail: j.error, latency: lat });
      } catch (e: any) {
        upd("providers", p.id, { status: "fail", detail: e.message });
      }
    }

    await delay(200);

    // ── SECTION 3: FALLBACK CHAIN ─────────────────────────────
    let fbPath = "";
    for (const step of [
      { id: "fb_claude", provider: "claude", label: "Claude" },
      { id: "fb_openai", provider: "openai", label: "OpenAI" },
      { id: "fb_gemini", provider: "gemini", label: "Gemini" },
    ]) {
      upd("fallback", step.id, { status: "running" });
      const t = Date.now();
      const res = await fetch("/api/test-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: step.provider, accessToken: token }) });
      const j = await res.json();
      const lat = Date.now() - t;
      if (j.ok) {
        fbPath = step.label;
        upd("fallback", step.id, { status: "pass", value: `${step.label} → active (${lat}ms)`, latency: lat });
        break;
      } else {
        upd("fallback", step.id, { status: "fail", detail: `${step.label} failed — next provider`, latency: lat });
      }
    }
    upd("fallback", "fb_chain", fbPath
      ? { status: "pass", value: `Active provider: ${fbPath}` }
      : { status: "fail", detail: "All providers failed" });

    await delay(200);

    // ── SECTION 4: AI ENGINEER HEALTH ────────────────────────
    upd("ai_eng", "aie_sess", { status: "running" });
    try {
      const { data, error } = await supabase.from("ai_engineer_sessions").select("id, status, created_at").order("created_at", { ascending: false }).limit(1);
      upd("ai_eng", "aie_sess", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: data?.length ? `Last: ${data[0].status}` : "Table accessible" });
    } catch (e: any) {
      upd("ai_eng", "aie_sess", { status: "fail", detail: e.message });
    }

    upd("ai_eng", "aie_mem", { status: "running" });
    try {
      const { data, error } = await supabase.from("ai_engineer_memory").select("id").limit(5);
      upd("ai_eng", "aie_mem", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: `${data?.length || 0} memories retrieved` });
    } catch (e: any) {
      upd("ai_eng", "aie_mem", { status: "fail", detail: e.message });
    }

    upd("ai_eng", "aie_hist", { status: "running" });
    try {
      const { data, error } = await supabase.from("ai_engineer_memory").select("id, title, memory_type, verification_score").order("verification_score", { ascending: false }).limit(3);
      upd("ai_eng", "aie_hist", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: `Top ${data?.length || 0} memories ranked` });
    } catch (e: any) {
      upd("ai_eng", "aie_hist", { status: "fail", detail: e.message });
    }

    upd("ai_eng", "aie_patch", { status: "running" });
    try {
      const { error } = await supabase.from("ai_engineer_patches").select("id").limit(1);
      upd("ai_eng", "aie_patch", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: "Patch table accessible" });
    } catch (e: any) {
      upd("ai_eng", "aie_patch", { status: "fail", detail: e.message });
    }

    upd("ai_eng", "aie_appr", { status: "running" });
    try {
      const { data, error } = await supabase.from("ai_engineer_patches").select("id, status").eq("status", "proposed").limit(5);
      upd("ai_eng", "aie_appr", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: `${data?.length || 0} pending approvals` });
    } catch (e: any) {
      upd("ai_eng", "aie_appr", { status: "fail", detail: e.message });
    }

    upd("ai_eng", "aie_audit", { status: "running" });
    try {
      const { data, error } = await supabase.from("ai_engineer_audit_log").select("id").limit(1);
      upd("ai_eng", "aie_audit", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: "Audit log accessible" });
    } catch (e: any) {
      upd("ai_eng", "aie_audit", { status: "fail", detail: e.message });
    }

    upd("ai_eng", "aie_roll", { status: "running" });
    try {
      const { data, error } = await supabase.from("ai_engineer_backups").select("id").limit(1);
      upd("ai_eng", "aie_roll", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: "Rollback/backup system OK" });
    } catch (e: any) {
      upd("ai_eng", "aie_roll", { status: "fail", detail: e.message });
    }

    await delay(200);

    // ── SECTION 5: MEMORY SYSTEM ──────────────────────────────
    upd("memory", "mem_table", { status: "running" });
    const t5 = Date.now();
    try {
      const { data, error } = await supabase.from("ai_engineer_memory").select("id, memory_type, verification_score, is_active").limit(100);
      const lat = Date.now() - t5;
      if (error) throw error;
      const total   = data?.length || 0;
      const active  = data?.filter(m => m.is_active).length || 0;
      const stale   = total - active;
      upd("memory", "mem_table",  { status: "pass", value: `${total} total memories`, latency: lat });
      upd("memory", "mem_ret",    { status: "pass", value: `Retrieved in ${lat}ms`, latency: lat });
      upd("memory", "mem_conf",   { status: data?.some(m => m.verification_score !== null) ? "pass" : "warn", value: "Confidence scores present" });
      upd("memory", "mem_stats",  { status: "pass", value: `Total: ${total} | Active: ${active} | Stale: ${stale}` });
    } catch (e: any) {
      ["mem_table", "mem_ret", "mem_conf", "mem_stats"].forEach(id =>
        upd("memory", id, { status: "fail", detail: e.message }));
    }

    upd("memory", "mem_pat", { status: "running" });
    try {
      const { error } = await supabase.from("ai_engineer_issue_patterns").select("id").limit(1);
      upd("memory", "mem_pat", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: "Issue patterns accessible" });
    } catch (e: any) {
      upd("memory", "mem_pat", { status: "fail", detail: e.message });
    }

    await delay(200);

    // ── SECTION 6: CREDITS SYSTEM ─────────────────────────────
    upd("credits", "cr_bal", { status: "running" });
    try {
      const { data: prof, error } = await supabase.from("profiles")
        .select("total_credits, used_credits, plan, daily_reset_date, credits_last_reset")
        .eq("id", userId).single();
      if (error) throw error;
      const rem = (prof.total_credits || 5) - (prof.used_credits || 0);
      upd("credits", "cr_bal",   { status: rem > 0 ? "pass" : "warn", value: `${rem} remaining (${prof.used_credits}/${prof.total_credits} used)` });
      upd("credits", "cr_plan",  { status: "pass", value: `Plan: ${prof.plan} | Limit: ${prof.total_credits}` });
      upd("credits", "cr_reset", { status: "pass", value: `Reset: ${prof.daily_reset_date || prof.credits_last_reset || "—"}` });
    } catch (e: any) {
      ["cr_bal", "cr_plan", "cr_reset"].forEach(id => upd("credits", id, { status: "fail", detail: e.message }));
    }

    upd("credits", "cr_trans", { status: "running" });
    try {
      const { data, error } = await supabase.from("credit_transactions").select("id").limit(1);
      upd("credits", "cr_trans", error
        ? { status: "fail", detail: error.message }
        : { status: "pass", value: "Transaction table OK" });
    } catch (e: any) {
      upd("credits", "cr_trans", { status: "fail", detail: e.message });
    }

    await delay(200);

    // ── SECTION 7: VERCEL ─────────────────────────────────────
    upd("vercel", "vc_token", { status: "running" });
    const vcRes = await fetch("/api/test-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "vercel_check", accessToken: token }) });
    const vcJ = await vcRes.json().catch(() => ({}));
    upd("vercel", "vc_token", vcJ.ok
      ? { status: "pass", value: "VERCEL_TOKEN configured" }
      : { status: vcJ.missing ? "fail" : "warn", detail: vcJ.error });

    upd("vercel", "vc_api", { status: "running" });
    if (vcJ.ok) {
      const t = Date.now();
      try {
        const res = await fetch("/api/test-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "vercel_api", accessToken: token }) });
        const j = await res.json();
        const lat = Date.now() - t;
        upd("vercel", "vc_api", j.ok ? { status: "pass", value: j.message, latency: lat } : { status: "fail", detail: j.error });
        upd("vercel", "vc_last", { status: "pass", value: j.lastDeploy || "Unknown" });
      } catch (e: any) {
        upd("vercel", "vc_api", { status: "fail", detail: e.message });
        upd("vercel", "vc_last", { status: "skip" });
      }
    } else {
      upd("vercel", "vc_api",  { status: "skip", value: "No token" });
      upd("vercel", "vc_last", { status: "skip", value: "No token" });
    }

    await delay(200);

    // ── SECTION 8: SECURITY ───────────────────────────────────
    upd("security", "sec_admin", { status: "running" });
    try {
      const { data: p, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
      upd("security", "sec_admin", error
        ? { status: "fail", detail: error.message }
        : { status: p?.role === "admin" ? "pass" : "fail", value: `Current role: ${p?.role}` });
    } catch (e: any) {
      upd("security", "sec_admin", { status: "fail", detail: e.message });
    }

    upd("security", "sec_jwt", { status: "running" });
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      upd("security", "sec_jwt", error || !user
        ? { status: "fail", detail: error?.message || "Token invalid" }
        : { status: "pass", value: `JWT valid — ${user.email}` });
    } catch (e: any) {
      upd("security", "sec_jwt", { status: "fail", detail: e.message });
    }

    upd("security", "sec_svc", { status: "running" });
    upd("security", "sec_svc", process.env.NEXT_PUBLIC_SUPABASE_URL
      ? { status: "pass", value: "Supabase URL configured" }
      : { status: "fail", detail: "NEXT_PUBLIC_SUPABASE_URL missing" });

    upd("security", "sec_save", { status: "running" });
    const saveRes = await fetch("/api/debug-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: token }) });
    const saveJ = await saveRes.json().catch(() => ({}));
    upd("security", "sec_save", saveJ.step === "SUCCESS"
      ? { status: "pass", value: "Authenticated project save OK" }
      : { status: "fail", detail: saveJ.error });

    await delay(200);

    // ── SECTION 9: 24H MONITORING ─────────────────────────────
    const since24h = new Date(Date.now() - 86400000).toISOString();

    upd("monitoring", "mon_gen", { status: "running" });
    try {
      const { data, error } = await supabase.from("generation_logs").select("id, status").gte("created_at", since24h);
      if (error) throw error;
      const total   = data?.length || 0;
      const failed  = data?.filter(l => l.status === "failed").length || 0;
      const success = data?.filter(l => l.status === "completed").length || 0;
      const rate    = total > 0 ? Math.round((success / total) * 100) : 0;
      upd("monitoring", "mon_gen", { status: rate >= 70 ? "pass" : rate >= 40 ? "warn" : "fail", value: `${total} generations | ${success} success | ${failed} failed | ${rate}% rate` });
    } catch (e: any) {
      upd("monitoring", "mon_gen", { status: "fail", detail: e.message });
    }

    upd("monitoring", "mon_fail", { status: "running" });
    try {
      const { data, error } = await supabase.from("generation_logs").select("id, error_message, prompt").eq("status", "failed").gte("created_at", since24h).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      upd("monitoring", "mon_fail", {
        status: (data?.length || 0) === 0 ? "pass" : "warn",
        value: `${data?.length || 0} failures in last 24h${data?.length ? ` — Latest: "${data[0].prompt?.slice(0, 30)}..."` : ""}`,
      });
    } catch (e: any) {
      upd("monitoring", "mon_fail", { status: "fail", detail: e.message });
    }

    upd("monitoring", "mon_aie", { status: "running" });
    try {
      const { data, error } = await supabase.from("ai_engineer_sessions").select("id, status").gte("created_at", since24h);
      if (error) throw error;
      upd("monitoring", "mon_aie", { status: "pass", value: `${data?.length || 0} sessions in 24h` });
    } catch (e: any) {
      upd("monitoring", "mon_aie", { status: "fail", detail: e.message });
    }

    upd("monitoring", "mon_dep", { status: "running" });
    try {
      const { data, error } = await supabase.from("deployments").select("id, status").gte("created_at", since24h);
      if (error) throw error;
      upd("monitoring", "mon_dep", { status: "pass", value: `${data?.length || 0} deployments in 24h` });
    } catch (e: any) {
      upd("monitoring", "mon_dep", { status: "fail", detail: e.message });
    }

    // ── FINAL SCORE ───────────────────────────────────────────
    setSections(prev => {
      const updated = prev.map(s => ({ ...s, score: sectionScore(s.checks) }));
      const totalScore = Math.round(updated.reduce((sum, s) => sum + (s.score || 0), 0) / updated.length);
      setScore(totalScore);
      return updated;
    });

    setRunning(false);
    setDone(true);
  }

  if (!allowed) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
      Checking access...
    </div>
  );

  const scoreColor = score >= 80 ? C.green : score >= 60 ? C.orange : C.red;
  const scoreLabel = score >= 80 ? "Healthy" : score >= 60 ? "Degraded" : "Critical";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>

      {/* Top Bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/admin/monitor" style={{ color: C.muted, fontSize: 13, textDecoration: "none" }}>← Monitor</a>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🔬 Production Operations Center</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(245,216,0,0.1)", color: C.gold, border: `1px solid ${C.borderGold}` }}>ADMIN</span>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          style={{
            background: running ? C.card2 : "linear-gradient(135deg,#F5D800,#10B981)",
            color: running ? C.muted : "#000", border: "none", borderRadius: 8,
            padding: "8px 20px", fontWeight: 700, fontSize: 13,
            cursor: running ? "default" : "pointer",
          }}
        >
          {running ? "⏳ Running..." : "▶ Run All Checks"}
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {/* Score Card */}
        {done && (
          <div style={{
            background: C.card, border: `1px solid ${scoreColor}44`,
            borderRadius: 16, padding: "20px 24px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 12, color: C.muted }}>/ 100</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: scoreColor, marginBottom: 8 }}>
                System Score: {score}/100 — {scoreLabel}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sections.map(s => (
                  <span key={s.id} style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 20,
                    background: `${(s.score || 0) >= 80 ? C.green : (s.score || 0) >= 60 ? C.orange : C.red}18`,
                    color: (s.score || 0) >= 80 ? C.green : (s.score || 0) >= 60 ? C.orange : C.red,
                    border: `1px solid ${(s.score || 0) >= 80 ? C.green : (s.score || 0) >= 60 ? C.orange : C.red}33`,
                  }}>
                    {s.icon} {s.title}: {s.score}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!running && !done && (
          <div style={{ textAlign: "center", padding: "64px 0", color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Production Operations Center</div>
            <div style={{ fontSize: 14 }}>Click "Run All Checks" to perform a complete system audit</div>
          </div>
        )}

        {/* Sections */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 16 }}>
          {sections.map(section => {
            const hasRun   = section.checks.some(c => c.status !== "idle");
            const allPass  = section.checks.every(c => c.status === "pass" || c.status === "skip");
            const hasFail  = section.checks.some(c => c.status === "fail");
            const borderC  = !hasRun ? C.border : hasFail ? `${C.red}44` : allPass ? `${C.green}33` : `${C.orange}44`;

            return (
              <div key={section.id} style={{ background: C.card, border: `1px solid ${borderC}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Section header */}
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{section.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{section.title}</span>
                  </div>
                  {section.score !== undefined && hasRun && (
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                      background: `${(section.score) >= 80 ? C.green : (section.score) >= 60 ? C.orange : C.red}18`,
                      color: (section.score) >= 80 ? C.green : (section.score) >= 60 ? C.orange : C.red,
                    }}>{section.score}%</span>
                  )}
                </div>

                {/* Checks */}
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {section.checks.map(check => (
                    <div key={check.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 8px", borderRadius: 8, background: check.status === "fail" ? "rgba(239,68,68,0.05)" : "transparent" }}>
                      {/* Status icon */}
                      <div style={{ flexShrink: 0, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        {check.status === "running" ? (
                          <div style={{ width: 14, height: 14, border: `2px solid ${C.gold}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        ) : (
                          <span style={{ color: STATUS_COLOR[check.status], fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{STATUS_ICON[check.status]}</span>
                        )}
                      </div>

                      {/* Label + value */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: check.status === "fail" ? "#FCA5A5" : C.text }}>{check.label}</div>
                        {check.value && <div style={{ fontSize: 11, color: STATUS_COLOR[check.status], fontFamily: "monospace", marginTop: 2 }}>{check.value}</div>}
                        {check.detail && <div style={{ fontSize: 11, color: "#FCA5A5", fontFamily: "monospace", marginTop: 2, wordBreak: "break-all" }}>⚠ {check.detail}</div>}
                        {check.status === "running" && <div style={{ fontSize: 11, color: C.gold, animation: "pulse 1.5s ease infinite", marginTop: 2 }}>Checking...</div>}
                      </div>

                      {/* Latency */}
                      {check.latency && (
                        <div style={{ fontSize: 10, color: check.latency > 1000 ? C.orange : C.muted2, flexShrink: 0, fontFamily: "monospace" }}>{check.latency}ms</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
