// =============================================================================
// Supabase Edge Function: create-teacher
// Path: supabase/functions/create-teacher/index.ts
// Runtime: Deno / Supabase Edge Runtime
//
// Description: Secure server-side teacher account provisioning.
// - Authenticates the caller and enforces public.profiles.role === 'director' (403 if not).
// - Validates duplicate email/username in both Auth and Profiles (409 if exists).
// - Uses the privileged SUPABASE_SERVICE_ROLE_KEY (exclusively on the server) to create
//   the auth user with an auto-generated temporary password and role='teacher' profile.
// - Returns temporary credentials once to the Director for manual onboarding.
//
// PRODUCTION ROLLOUT NOTE:
// In a production deployment, the temporary credentials should NOT be returned in
// the HTTP response or rendered on-screen. Instead, an invitation email containing a
// secure one-time password setup link or auto-generated credential token should be
// dispatched directly to the teacher's email address (via Resend, SendGrid, or Supabase
// Auth Invites). For the institutional pilot, displaying the credentials once on-screen
// for manual handover by the Director is accepted.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Standard CORS headers for frontend consumption
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Generate a cryptographically secure 10-character temporary password
 * containing uppercase, lowercase, numbers, and an allowable symbol.
 */
function generateTemporaryPassword(length = 10): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%&*";
  const allChars = upper + lower + numbers + special;

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  // Guarantee at least one character from each required set
  let pwd = [
    upper[array[0] % upper.length],
    lower[array[1] % lower.length],
    numbers[array[2] % numbers.length],
    special[array[3] % special.length],
  ];

  for (let i = 4; i < length; i++) {
    pwd.push(allChars[array[i] % allChars.length]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join("");
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Only POST is supported." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing required server environment variables.");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Supabase service keys are not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authenticate the caller using their Authorization bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Client operating in the context of the requesting user (enforces RLS)
    const callerClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user: callerUser }, error: callerAuthError } = await callerClient.auth.getUser();

    if (callerAuthError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authorize caller: Verify caller's role is 'director' in public.profiles
    // Create admin client (bypasses RLS for directory inspection and user provisioning)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", callerUser.id)
      .single();

    if (profileErr || !callerProfile || callerProfile.role !== "director") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: Administrative director authorization is required to create faculty accounts.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse and validate request payload
    let body: { full_name?: string; email?: string; class_sections_taught?: string | string[] };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { full_name, email, class_sections_taught } = body;

    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Faculty member's full name is required (minimum 2 characters)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: "A valid email address is required for institutional faculty credentials." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanFullName = full_name.trim();
    const classSectionsStr = Array.isArray(class_sections_taught)
      ? class_sections_taught.join(", ")
      : (class_sections_taught ? String(class_sections_taught).trim() : "XI-B");

    // 4. Duplicate Check: Ensure user with this email does not already exist
    // Check both profiles table and auth.users
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("student_id_code", normalizedEmail) // in case used as identifier
      .maybeSingle();

    const { data: { users: matchingAuthUsers }, error: searchErr } = await adminClient.auth.admin.listUsers();
    const userAlreadyExists = matchingAuthUsers?.some(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingProfile || userAlreadyExists) {
      return new Response(
        JSON.stringify({
          error: "A user with this email/username already exists in the institutional registry.",
          code: "USER_ALREADY_EXISTS",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Generate secure temporary password
    const temporaryPassword = generateTemporaryPassword(10);

    // 6. Provision Auth user with role='teacher' in metadata
    const { data: newAuthData, error: createUserError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanFullName,
        role: "teacher",
        class_section: classSectionsStr,
      },
    });

    if (createUserError || !newAuthData?.user) {
      console.error("Error creating auth user:", createUserError);
      return new Response(
        JSON.stringify({
          error: createUserError?.message || "Failed to provision faculty user in authentication service.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = newAuthData.user.id;

    // 7. Ensure profile row in public.profiles exists and is assigned role='teacher'
    // (The database trigger handle_new_user might insert a default row; we upsert to guarantee teacher role & classes)
    const { error: upsertProfileError } = await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        full_name: cleanFullName,
        role: "teacher",
        class_section: classSectionsStr,
        stream: "Commerce & Humanities",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (upsertProfileError) {
      console.warn("Notice updating profile row:", upsertProfileError);
    }

    // 8. Return the generated username and temporary password ONCE
    return new Response(
      JSON.stringify({
        success: true,
        message: "Faculty account provisioned successfully.",
        credentials: {
          id: newUserId,
          full_name: cleanFullName,
          email: normalizedEmail,
          temporary_password: temporaryPassword,
          role: "teacher",
          class_sections_taught: classSectionsStr,
        },
        notice: "Please securely provide these credentials to the teacher. They should change their password on first sign-in.",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unhandled error in create-teacher:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error occurred while creating teacher account." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
