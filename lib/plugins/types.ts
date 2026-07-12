// lib/plugins/types.ts
// Production-ready extension-point contract for future plugin integrations
// (GitHub, Figma, Google Drive, Notion, Vercel, Supabase, and any future
// OAuth-based provider). This defines the SHAPE a real integration must
// implement — it does not implement any integration itself. No plugin
// listed here is "connected"; AttachmentMenu.tsx already shows this
// honestly (disabled, no OAuth credentials configured).
//
// A real integration is added by:
//   1. Implementing this interface in lib/plugins/providers/<name>.ts
//   2. Registering it in the PLUGIN_REGISTRY below
//   3. Adding real OAuth credentials as environment variables
//   4. Adding a real callback route under app/api/plugins/<name>/callback
// Until all 4 steps exist for a given provider, it must be shown as
// disabled/not-connected — never as a fake "connected" state.

export type PluginId = "github" | "figma" | "gdrive" | "notion" | "vercel" | "supabase";

export interface PluginConnectionStatus {
  connected: boolean;
  accountLabel?: string;   // e.g. connected GitHub username, shown in UI when connected
  connectedAt?: string;    // ISO timestamp
  scopes?: string[];       // OAuth scopes actually granted
}

export interface PluginOAuthConfig {
  authorizeUrl: string;    // provider's OAuth authorize endpoint
  tokenUrl: string;        // provider's token-exchange endpoint
  clientIdEnvVar: string;  // name of the env var holding the client id (never the value itself)
  clientSecretEnvVar: string;
  scopes: string[];
  redirectPath: string;    // e.g. "/api/plugins/github/callback"
}

// A plugin's real capabilities — implemented ONLY once genuinely wired to
// a live API. Each method should throw a clear "not implemented" error
// until real credentials + a real API client exist — never return mocked data.
export interface PluginProvider {
  id: PluginId;
  label: string;
  icon: string;
  oauth: PluginOAuthConfig;

  // Returns real connection status for the given user — must query the
  // actual stored token/connection record, never assume "connected".
  getStatus(userId: string): Promise<PluginConnectionStatus>;

  // Exchanges an OAuth code for real tokens and persists them securely
  // (encrypted at rest). Must throw if the exchange fails — never silently
  // report success.
  connect(userId: string, oauthCode: string): Promise<PluginConnectionStatus>;

  // Revokes the token with the provider (where the provider supports
  // revocation) and deletes the stored connection record.
  disconnect(userId: string): Promise<void>;
}

// ── Registry ──────────────────────────────────────────────────────
// Intentionally empty until a provider is genuinely implemented end-to-end
// (OAuth app registered, callback route built, token storage in place).
// AttachmentMenu.tsx and any future plugin UI should treat "not in this
// registry" identically to "not connected" — never fabricate an entry.
export const PLUGIN_REGISTRY: Partial<Record<PluginId, PluginProvider>> = {};

export function isPluginImplemented(id: PluginId): boolean {
  return id in PLUGIN_REGISTRY;
}

