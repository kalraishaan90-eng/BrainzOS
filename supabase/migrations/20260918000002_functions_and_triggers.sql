-- =============================================================================
-- Migration: 20260918000002_functions_and_triggers.sql
-- Description: Security Helper Functions, Auth Triggers, and Business Logic
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY HELPER FUNCTIONS (Used in RLS Policies)
-- -----------------------------------------------------------------------------

-- Helper: Check if current user is an authenticated director
CREATE OR REPLACE FUNCTION public.is_director()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'director'
    );
$$;

-- Helper: Check if current user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
$$;

-- Helper: Check if current user is a teacher for a specific class section
-- Evaluates home section assignment, timetable schedule, or assignment creation
CREATE OR REPLACE FUNCTION public.is_teacher_of(target_class_section TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'teacher'
          AND (
              target_class_section IS NULL
              OR p.class_section = target_class_section
              OR EXISTS (
                  SELECT 1 FROM public.timetable_entries t
                  WHERE t.teacher_id = auth.uid() AND t.class_section = target_class_section
              )
              OR EXISTS (
                  SELECT 1 FROM public.assignments a
                  WHERE a.created_by = auth.uid() AND a.class_section = target_class_section
              )
          )
    );
$$;

-- -----------------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER UTILITY
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ventures_updated_at ON public.ventures;
CREATE TRIGGER trg_ventures_updated_at
    BEFORE UPDATE ON public.ventures
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3. AUTH TRIGGER: AUTO-CREATE PROFILE ON SIGNUP
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role public.user_role;
    v_role_text TEXT;
BEGIN
    -- Extract and validate requested role from user metadata
    v_role_text := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'student'));
    IF v_role_text IN ('student', 'teacher', 'director') THEN
        v_role := v_role_text::public.user_role;
    ELSE
        v_role := 'student'::public.user_role;
    END IF;

    -- Insert corresponding profile record
    INSERT INTO public.profiles (
        id,
        full_name,
        role,
        class_section,
        stream,
        house_id,
        student_id_code,
        avatar_url
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            INITCAP(SPLIT_PART(NEW.email, '@', 1))
        ),
        v_role,
        NEW.raw_user_meta_data->>'class_section',
        NEW.raw_user_meta_data->>'stream',
        NULLIF(NEW.raw_user_meta_data->>'house_id', '')::UUID,
        NEW.raw_user_meta_data->>'student_id_code',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

    RETURN NEW;
END;
$$;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. ROLE ESCALATION DEFENSE TRIGGER
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the role column is being modified
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Only allow if the requesting user is a director
        IF NOT public.is_director() THEN
            RAISE EXCEPTION 'Permission Denied: Only a Director can modify user roles (from % to %)', OLD.role, NEW.role;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- -----------------------------------------------------------------------------
-- 5. VENTURE VOTES SYNCHRONIZATION TRIGGERS
-- -----------------------------------------------------------------------------

-- Automatically sync votes count in ventures table when votes are cast or deleted
CREATE OR REPLACE FUNCTION public.sync_venture_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_venture_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        target_venture_id := NEW.venture_id;
    ELSE
        target_venture_id := OLD.venture_id;
    END IF;

    -- Recalculate exact vote count from single source of truth
    UPDATE public.ventures
    SET votes = (
        SELECT COUNT(*)::INTEGER
        FROM public.venture_votes
        WHERE venture_id = target_venture_id
    )
    WHERE id = target_venture_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_venture_votes ON public.venture_votes;
CREATE TRIGGER trg_sync_venture_votes
    AFTER INSERT OR DELETE ON public.venture_votes
    FOR EACH ROW EXECUTE FUNCTION public.sync_venture_votes();

-- Prevent direct manual manipulation of votes count on ventures
CREATE OR REPLACE FUNCTION public.prevent_manual_venture_vote_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Recalculate true votes from venture_votes to ensure vote count is never forged
    IF NEW.votes IS DISTINCT FROM OLD.votes THEN
        NEW.votes := (
            SELECT COUNT(*)::INTEGER
            FROM public.venture_votes
            WHERE venture_id = NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_manual_venture_vote_tampering ON public.ventures;
CREATE TRIGGER trg_prevent_manual_venture_vote_tampering
    BEFORE UPDATE OF votes ON public.ventures
    FOR EACH ROW EXECUTE FUNCTION public.prevent_manual_venture_vote_tampering();
