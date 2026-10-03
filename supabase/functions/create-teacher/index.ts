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
    let body: {
      full_name?: string;
      email?: string;
      class_sections_taught?: string | string[];
      class_section_ids?: string[];
    };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { full_name, email, class_sections_taught, class_section_ids } = body;

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
    if (!normalizedEmail.endsWith("@brainzeduworld.com")) {
      return new Response(
        JSON.stringify({ error: "Faculty email must be on the institutional domain (@brainzeduworld.com)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const cleanFullName = full_name.trim();

    // 3.1 Strict Server-Side Class Section Validation
    // Validate every submitted class_section id exists in class_sections and is active. Never trust client list.
    let submittedIds: string[] = [];
    if (Array.isArray(class_section_ids) && class_section_ids.length > 0) {
      submittedIds = class_section_ids.map(id => String(id).trim()).filter(Boolean);
    } else if (Array.isArray(class_sections_taught) && class_sections_taught.length > 0) {
      submittedIds = class_sections_taught.map(id => String(id).trim()).filter(Boolean);
    } else if (typeof class_sections_taught === "string" && class_sections_taught.trim()) {
      submittedIds = class_sections_taught.split(",").map(s => s.trim()).filter(Boolean);
    }

    if (submittedIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one class section must be selected for the faculty member." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query active class sections from database
    const { data: allDbSections, error: csErr } = await adminClient
      .from("class_sections")
      .select("id, grade, section, stream, display_name, active");

    if (csErr) {
      console.error("Failed to query class_sections:", csErr);
      return new Response(
        JSON.stringify({ error: "Failed to validate class sections against institutional registry." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const availableSections = allDbSections || [];
    const validatedSections: typeof availableSections = [];

    const toRoman = (n: number) => {
      const rom: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII" };
      return rom[n] || String(n);
    };

    for (const token of submittedIds) {
      const match = availableSections.find(cs =>
        cs.id === token ||
        cs.display_name.toLowerCase() === token.toLowerCase() ||
        `${cs.grade}-${cs.section}`.toLowerCase() === token.toLowerCase() ||
        (cs.grade >= 11 && `${toRoman(cs.grade)}-${cs.section}`.toLowerCase() === token.toLowerCase()) ||
        (cs.grade >= 11 && `${toRoman(cs.grade)}-${cs.section} ${cs.stream}`.toLowerCase() === token.toLowerCase()) ||
        (cs.grade >= 11 && `Class ${toRoman(cs.grade)}-${cs.section}`.toLowerCase() === token.toLowerCase())
      );

      if (!match) {
        return new Response(
          JSON.stringify({
            error: `Invalid class section: "${token}" does not exist in the institutional class registry.`,
            code: "CLASS_SECTION_NOT_FOUND"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!match.active) {
        return new Response(
          JSON.stringify({
            error: `Class section "${match.display_name}" is deactivated. Only active sections can be assigned to faculty.`,
            code: "CLASS_SECTION_INACTIVE"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!validatedSections.some(v => v.id === match.id)) {
        validatedSections.push(match);
      }
    }

    if (validatedSections.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid, active class sections were provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build standard section code format for backward compatibility (e.g. "XI-B", "3-A", "8-A", "XII-A")
    const classSectionCodes = validatedSections.map(cs => {
      if (cs.grade >= 11) {
        return `${toRoman(cs.grade)}-${cs.section}`;
      }
      return `${cs.grade}-${cs.section}`;
    });

    const classSectionsStr = classSectionCodes.join(", ");
    const verifiedDisplayNames = validatedSections.map(cs => cs.display_name).join(", ");

    // 4. Duplicate Check (registry hints only; auth.users is the authority)
    // public.profiles has no email column; Supabase Auth is the sole owner of
    // account emails. The student_id_code lookup below only surfaces legacy rows
    // where the institutional identifier was stored as the email — the definitive
    // duplicate guard is mapping createUser's own error (see step 6), which is
    // race-free by construction (no pre-scan window for two concurrent calls).
    const { data: existingProfile, error: profileLookupError } = await adminClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("student_id_code", normalizedEmail)
      .maybeSingle();

    if (profileLookupError) {
      console.error("Profile duplicate lookup failed:", profileLookupError);
      return new Response(
        JSON.stringify({ error: "Could not verify the institutional registry. Please retry." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingProfile) {
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
      // Acceptable for institutional pilot; production should use a real confirmation email flow instead
      email_confirm: true,
      user_metadata: {
        full_name: cleanFullName,
        role: "teacher",
        class_section: classSectionsStr,
        must_change_password: true,
      },
    });

    if (createUserError || !newAuthData?.user) {
      console.error("Error creating auth user:", createUserError);
      // Supabase Auth rejects a duplicate email with status 422 and code
      // "email_exists" (message "User already registered"). Map it to our
      // canonical 409 instead of a generic 400 so the director UI can say
      // "account exists" rather than "failed to provision". Checking the error
      // itself (instead of pre-scanning listUsers pages) is race-free: two
      // concurrent calls cannot both pass a pre-scan, but only one can create.
      const errStatus = (createUserError as { status?: number } | null)?.status;
      const errCode = (createUserError as { code?: string } | null)?.code;
      const isDuplicate =
        errCode === "email_exists" ||
        errStatus === 422 ||
        /already registered/i.test(createUserError?.message || "");
      if (isDuplicate) {
        return new Response(
          JSON.stringify({
            error: "A user with this email/username already exists in the institutional registry.",
            code: "USER_ALREADY_EXISTS",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          error: createUserError?.message || "Failed to provision faculty user in authentication service.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = newAuthData.user.id;

    // 7. Update profile row in public.profiles created by the on_auth_user_created database trigger
    // (The handle_new_user trigger inserts a row on auth.users insert; update it instead of inserting a new one to prevent race condition)
    const { error: updateProfileError } = await adminClient
      .from("profiles")
      .update({
        full_name: cleanFullName,
        email: normalizedEmail,
        role: "teacher",
        role_confirmed: true,
        class_section: classSectionsStr,
        stream: "Commerce & Humanities",
        updated_at: new Date().toISOString(),
      })
      .eq("id", newUserId);

    if (updateProfileError) {
      // The auth user was already created: roll it back so a half-provisioned
      // account cannot linger without a usable profile (a retry would then hit 409
      // forever). We deliberately surface the profile error instead of swallowing it.
      console.error("Profile update failed, deleting orphaned auth user:", updateProfileError);
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: "Auth user created but profile provisioning failed; please retry." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
