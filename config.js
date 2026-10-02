/**
 * BrainzOS — Institutional Environment & Local Supabase Configuration
 * =========================================================================
 * Single-origin self-hosted configuration.
 * All traffic stays on the local school host (window.location.origin).
 * Zero cloud dependencies or external third-party telemetry.
 *
 * The bundled Supabase-compatible backend (scripts/serve.js) serves auth
 * (/auth/v1), PostgREST-style data (/rest/v1), and realtime (/realtime/v1/sse)
 * on the same origin, so the anon key must be a non-placeholder token —
 * placeholders ("mock-token*", empty) disable the live client entirely and
 * drop every session into local-only demo mode (no cross-tab sync).
 * =========================================================================
 */
window.BRAINZOS_CONFIG = {
  SUPABASE_URL: (typeof window !== 'undefined' && window.BRAINZOS_SUPABASE_URL) || "",
  SUPABASE_ANON_KEY: (typeof window !== 'undefined' && window.BRAINZOS_SUPABASE_ANON_KEY) || "local-institutional-anon-key"
};
