-- =============================================================================
-- Migration: 20260929000002_domain_lock_single_director_and_role_approvals.sql
-- Description: Database-level Domain Lock, Single Director Constraint, Role Auto-Suggestion,
--              and Director Role Confirmation Governance.
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTEND ENUMS & PROFILES SCHEMA
-- -----------------------------------------------------------------------------

-- Add 'pending' to user_role enum if not already present
DO $$ BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add 'disabled' and 'rejected' to profile_status enum if not already present
DO $$ BEGIN
    ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'disabled';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add email and role_confirmed columns to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_confirmed BOOLEAN NOT NULL DEFAULT false;

-- Sync email addresses for existing profiles from auth.users
UPDATE public.profiles p
SET email = LOWER(TRIM(u.email))
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Set role_confirmed = true for active pre-existing profiles
UPDATE public.profiles
SET role_confirmed = true
WHERE role_confirmed = false AND status = 'active';

-- Add index on email for quick profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role_confirmed ON public.profiles (role_confirmed);

-- -----------------------------------------------------------------------------
-- 2. APP_CONFIG TABLE & SINGLE DIRECTOR ENFORCEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_read_authenticated" ON public.app_config;
CREATE POLICY "app_config_read_authenticated"
    ON public.app_config FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "app_config_modify_director_only" ON public.app_config;
CREATE POLICY "app_config_modify_director_only"
    ON public.app_config FOR ALL
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

-- Seed designated Director email: taarini@brainzeduworld.com
INSERT INTO public.app_config (key, value, description)
VALUES (
    'director_email',
    'taarini@brainzeduworld.com',
    'Designated institutional Director email address with exclusive executive authority'
)
ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = timezone('utc'::text, now());

-- Clean up any multiple directors if pre-existing from local seed/test runs
-- so the partial unique index can be safely created
UPDATE public.profiles
SET role = 'teacher'
WHERE role = 'director'
  AND LOWER(COALESCE(email, student_id_code, '')) != 'taarini@brainzeduworld.com'
  AND id NOT IN (
      SELECT id FROM public.profiles
      WHERE role = 'director'
      ORDER BY created_at ASC
      LIMIT 1
  );

-- Partial unique index: Exactly ONE director permitted in the entire database
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_single_director
    ON public.profiles (role)
    WHERE role = 'director';

-- -----------------------------------------------------------------------------
-- 3. DOMAIN LOCK TRIGGER ON auth.users
-- -----------------------------------------------------------------------------
-- Only emails ending in @brainzeduworld.com may create an account.
-- Enforced via BEFORE INSERT trigger on auth.users that raises an exception.

CREATE OR REPLACE FUNCTION public.check_user_domain_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_clean_email TEXT;
    v_domain TEXT;
BEGIN
    IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
        RAISE EXCEPTION 'Registration failed: Institutional email address is required.';
    END IF;

    -- Normalize to lowercase
    v_clean_email := LOWER(TRIM(NEW.email));
    NEW.email := v_clean_email;

    -- Extract domain part
    v_domain := SPLIT_PART(v_clean_email, '@', 2);

    IF v_domain != 'brainzeduworld.com' THEN
        RAISE EXCEPTION 'Access restricted: Only @brainzeduworld.com institutional email addresses are permitted to create an account.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_domain_lock ON auth.users;
CREATE TRIGGER trg_auth_users_domain_lock
    BEFORE INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_domain_lock();

-- -----------------------------------------------------------------------------
-- 4. ROLE SUGGESTION FROM EMAIL PATTERN: suggest_role(email)
-- -----------------------------------------------------------------------------
-- - Local part equals configured director email -> 'director'
-- - Local part matches ^[a-z]{2}[0-9]+$ (two initials + digits, e.g. ik10130) -> 'student'
-- - Local part matches ^[a-z]+([._][a-z]+)*$ (letters only, no digits, e.g. ambika or ambika.sharma) -> 'teacher'
-- - Anything else -> 'pending'
-- Case-insensitive; normalizes email to lowercase.

CREATE OR REPLACE FUNCTION public.suggest_role(p_email TEXT)
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_clean_email TEXT;
    v_local TEXT;
    v_director_config TEXT;
    v_director_local TEXT;
BEGIN
    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RETURN 'pending'::public.user_role;
    END IF;

    v_clean_email := LOWER(TRIM(p_email));
    v_local := SPLIT_PART(v_clean_email, '@', 1);

    -- Retrieve configured director email from app_config (fallback to taarini@brainzeduworld.com)
    SELECT LOWER(TRIM(value)) INTO v_director_config
    FROM public.app_config
    WHERE key = 'director_email'
    LIMIT 1;

    IF v_director_config IS NULL OR v_director_config = '' THEN
        v_director_config := 'taarini@brainzeduworld.com';
    END IF;

    v_director_local := SPLIT_PART(v_director_config, '@', 1);

    -- 1. Local part equals configured director email OR matches full director email
    IF v_local = v_director_local OR v_clean_email = v_director_config THEN
        RETURN 'director'::public.user_role;
    END IF;

    -- 2. Local part matches ^[a-z]{2}[0-9]+$ (two initials + digits, e.g. ik10130) -> 'student'
    IF v_local ~ '^[a-z]{2}[0-9]+$' THEN
        RETURN 'student'::public.user_role;
    END IF;

    -- 3. Local part matches ^[a-z]+([._][a-z]+)*$ (letters only, no digits, e.g. ambika or ambika.sharma) -> 'teacher'
    IF v_local ~ '^[a-z]+([._][a-z]+)*$' THEN
        RETURN 'teacher'::public.user_role;
    END IF;

    -- 4. Anything else -> 'pending'
    RETURN 'pending'::public.user_role;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. AUTH TRIGGER: AUTO-CREATE PROFILE ON SIGNUP
-- -----------------------------------------------------------------------------
-- Nobody can self-assign role at signup. Role is set by suggest_role(email).
-- role_confirmed is false by default; true automatically for the director.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_clean_email TEXT;
    v_role public.user_role;
    v_role_confirmed BOOLEAN;
    v_full_name TEXT;
    v_class_section TEXT;
    v_stream TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(NEW.email));

    -- Suggest role strictly from email pattern (never client metadata)
    v_role := public.suggest_role(v_clean_email);

    -- Director role is confirmed automatically; all other accounts require Director confirmation
    v_role_confirmed := (v_role = 'director');

    -- Derive full name
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        INITCAP(REPLACE(SPLIT_PART(v_clean_email, '@', 1), '.', ' '))
    );

    v_class_section := NULLIF(TRIM(NEW.raw_user_meta_data->>'class_section'), '');
    v_stream := NULLIF(TRIM(NEW.raw_user_meta_data->>'stream'), '');

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        role_confirmed,
        class_section,
        stream,
        house_id,
        student_id_code,
        avatar_url,
        status,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_clean_email,
        v_full_name,
        v_role,
        v_role_confirmed,
        v_class_section,
        v_stream,
        NULLIF(NEW.raw_user_meta_data->>'house_id', '')::UUID,
        NEW.raw_user_meta_data->>'student_id_code',
        NEW.raw_user_meta_data->>'avatar_url',
        'active',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 6. STRICT PROFILE MODIFICATION GUARD TRIGGER (PREVENT ROLE ESCALATION)
-- -----------------------------------------------------------------------------
-- Only Director can UPDATE role or role_confirmed.
-- Blocks any client from updating their own role.

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_dir BOOLEAN;
BEGIN
    v_is_dir := public.is_director();

    -- 1. Directors have full authorization across all profile records
    IF v_is_dir THEN
        -- Even for Director, guard against assigning director role to unauthorized emails
        IF NEW.role = 'director' AND OLD.role != 'director' THEN
            IF LOWER(COALESCE(NEW.email, '')) != (SELECT LOWER(value) FROM public.app_config WHERE key = 'director_email' LIMIT 1) THEN
                RAISE EXCEPTION 'Permission Denied: Only the institutional Director email configured in app_config can hold the director role.';
            END IF;
        END IF;

        NEW.updated_at := timezone('utc'::text, now());
        RETURN NEW;
    END IF;

    -- 2. Non-directors: Primary key ID is strictly immutable
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Permission Denied: User profile ID is strictly immutable.';
    END IF;

    -- 3. Non-directors: Cannot modify role under any circumstances
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Permission Denied: Cannot modify user role (from % to %). Role changes require Director authorization.', OLD.role, NEW.role;
    END IF;

    -- 4. Non-directors: Cannot modify role_confirmed status
    IF NEW.role_confirmed IS DISTINCT FROM OLD.role_confirmed THEN
        RAISE EXCEPTION 'Permission Denied: Only the School Director can confirm or modify account approval status.';
    END IF;

    -- 5. Non-directors: Auth-linked email cannot be altered on public.profiles
    IF (to_jsonb(NEW) ? 'email') AND ((to_jsonb(NEW) ->> 'email') IS DISTINCT FROM (to_jsonb(OLD) ->> 'email')) THEN
        RAISE EXCEPTION 'Permission Denied: Cannot modify auth-linked email address.';
    END IF;

    -- 6. Unconfirmed accounts cannot modify profile records (except initial student class_section completion)
    IF NOT OLD.role_confirmed THEN
        IF OLD.role = 'student' AND OLD.class_section IS NULL AND NEW.class_section IS NOT NULL THEN
            -- Permitted: First-login profile completion for student section/stream
            NEW.updated_at := timezone('utc'::text, now());
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Permission Denied: Account is pending Director approval.';
    END IF;

    -- 7. Teacher editing student profile
    IF public.is_teacher() AND OLD.role = 'student' THEN
        IF OLD.class_section IS NULL OR NOT public.is_teacher_of(OLD.class_section) THEN
            RAISE EXCEPTION 'Permission Denied: Teachers can only edit profile details of students in classes they teach (section: %)', OLD.class_section;
        END IF;

        IF NEW.role != 'student' THEN
            RAISE EXCEPTION 'Permission Denied: Student role cannot be altered.';
        END IF;

        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            NEW.created_at := OLD.created_at;
        END IF;

        NEW.updated_at := timezone('utc'::text, now());
        RETURN NEW;
    END IF;

    -- 8. Students modifying their own profile
    IF OLD.role = 'student' THEN
        IF NEW.class_section IS DISTINCT FROM OLD.class_section AND OLD.class_section IS NOT NULL THEN
            RAISE EXCEPTION 'Permission Denied: Students cannot modify their class section.';
        END IF;
        IF NEW.student_id_code IS DISTINCT FROM OLD.student_id_code THEN
            RAISE EXCEPTION 'Permission Denied: Students cannot modify their institutional student ID.';
        END IF;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_profile_modifications ON public.profiles;
CREATE TRIGGER trg_prevent_unauthorized_profile_modifications
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_profile_modifications();

-- -----------------------------------------------------------------------------
-- 7. UPDATE HELPER SECURITY FUNCTIONS TO ENFORCE ROLE_CONFIRMED
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_director()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'director'
          AND role_confirmed = true
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'teacher'
          AND role_confirmed = true
          AND status = 'active'
    );
$$;

-- -----------------------------------------------------------------------------
-- 8. DIRECTOR ACCOUNT APPROVAL RPCs
-- -----------------------------------------------------------------------------

-- Confirm user account and optionally assign role
CREATE OR REPLACE FUNCTION public.confirm_user_account(
    p_user_id UUID,
    p_assigned_role public.user_role DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_profile RECORD;
    v_final_role public.user_role;
BEGIN
    IF NOT public.is_director() THEN
        RAISE EXCEPTION 'Permission Denied: Only the School Director can confirm accounts.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found for id: %', p_user_id;
    END IF;

    IF p_assigned_role IS NOT NULL THEN
        IF p_assigned_role = 'director' THEN
            RAISE EXCEPTION 'Permission Denied: Cannot assign the director role via account approvals.';
        END IF;
        v_final_role := p_assigned_role;
    ELSE
        IF v_profile.role = 'pending' THEN
            RAISE EXCEPTION 'Cannot confirm an account with role "pending". Please assign a specific role (student or teacher).';
        END IF;
        v_final_role := v_profile.role;
    END IF;

    UPDATE public.profiles
    SET role = v_final_role,
        role_confirmed = true,
        status = 'active',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    -- Audit Log
    INSERT INTO public.audit_logs (actor_id, action, device)
    VALUES (
        auth.uid(),
        FORMAT('Director confirmed account for %s (%s) with role: %s', v_profile.full_name, v_profile.email, v_final_role),
        'Director Executive Console'
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'role', v_final_role,
        'role_confirmed', true
    );
END;
$$;

-- Reject user account and disable login
CREATE OR REPLACE FUNCTION public.reject_user_account(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_profile RECORD;
BEGIN
    IF NOT public.is_director() THEN
        RAISE EXCEPTION 'Permission Denied: Only the School Director can reject accounts.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found for id: %', p_user_id;
    END IF;

    IF v_profile.role = 'director' THEN
        RAISE EXCEPTION 'Permission Denied: Cannot reject the Director account.';
    END IF;

    -- Disable profile
    UPDATE public.profiles
    SET status = 'disabled',
        role_confirmed = false,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    -- Disable user in auth.users
    UPDATE auth.users
    SET banned_until = '3000-01-01 00:00:00+00'::timestamptz
    WHERE id = p_user_id;

    -- Audit Log
    INSERT INTO public.audit_logs (actor_id, action, device)
    VALUES (
        auth.uid(),
        FORMAT('Director rejected account for %s (%s) - Account disabled', v_profile.full_name, v_profile.email),
        'Director Executive Console'
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'status', 'disabled'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_user_account(UUID, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_user_account(UUID, public.user_role) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_user_account(UUID) TO authenticated;
