/**
 * BrainzOS — Institutional Environment & Supabase Configuration
 * =========================================================================
 * This configuration file isolates your backend API connection details
 * from the core BrainzOS application runtime.
 *
 * NOTE ON SECURITY (ANON KEY VS. SERVICE_ROLE KEY):
 * -------------------------------------------------------------------------
 * 1. The `SUPABASE_ANON_KEY` below is a public client token. In the Supabase
 *    and PostgREST security model, this key is explicitly DESIGNED to be
 *    exposed client-side in browser environments.
 * 2. It DOES NOT confer administrative privileges. Every single request made
 *    using this key is evaluated against PostgreSQL Row Level Security (RLS)
 *    policies based on the user's authenticated JSON Web Token (`auth.uid()`).
 * 3. CRITICAL AUDIT RULE: NEVER place a `service_role` key here or anywhere
 *    in frontend assets. The `service_role` key bypasses all RLS policies
 *    and must remain exclusively on secure backend servers or Edge Functions.
 *
 * ROTATION INSTRUCTIONS:
 * -------------------------------------------------------------------------
 * If you need to rotate your project keys:
 * 1. Navigate to Supabase Dashboard > Project Settings > API.
 * 2. If generating a new JWT secret / anon key, update the values below.
 * 3. In cloud hosting (Vercel/Netlify), these can also be injected as build-time
 *    environment variables or overridden at runtime via:
 *    window.BRAINZOS_SUPABASE_URL = "https://your-ref.supabase.co";
 *    window.BRAINZOS_SUPABASE_ANON_KEY = "eyJhbGciOi...";
 * =========================================================================
 */
window.BRAINZOS_CONFIG = {
  SUPABASE_URL: window.BRAINZOS_SUPABASE_URL || "https://slqufxrmgrhcqwapkipa.supabase.co",
  SUPABASE_ANON_KEY: window.BRAINZOS_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscXVmeHJtZ3JoY3F3YXBraXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwODc3OTAsImV4cCI6MjA2MDY2Mzc5MH0.z-Z8c6lX6Qh9-c8-mock-token-replace-with-real"
};
