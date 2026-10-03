-- =============================================================================
-- Migration: 20260928000001_academic_year_promotion.sql
-- Description: Academic Year-End Auto-Promotion System
--   Tables: academic_years, class_progression, final_results, promotion_records
--   Profiles extension: status column
--   RLS: all new tables covered, director-only for admin operations
--   Functions: preview_promotion, finalize_promotion, override_promotion, undo_finalize
-- Stack: Supabase PostgreSQL
-- POLICY: Extend only, never drop existing tables or columns.
-- =============================================================================

-- =============================================================================
-- 1. ENUM TYPES (idempotent)
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE public.academic_year_status AS ENUM ('active', 'closed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.promotion_outcome AS ENUM (
        'promoted', 'held_back', 'graduated',
        'override_promoted', 'override_held_back'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.profile_status AS ENUM ('active', 'graduated');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. EXTEND profiles TABLE
-- =============================================================================

-- Add status column (active/graduated). Default active; graduated set on
-- finalize_promotion when is_final=true.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS status public.profile_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- =============================================================================
-- 3. ACADEMIC YEARS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.academic_years (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label                       TEXT NOT NULL UNIQUE,          -- e.g. "2026-27"
    start_date                  DATE NOT NULL,
    end_date                    DATE NOT NULL,
    status                      public.academic_year_status NOT NULL DEFAULT 'active',
    pass_percentage             NUMERIC(5,2) NOT NULL DEFAULT 40.00
                                    CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
    require_subject_minimum     BOOLEAN NOT NULL DEFAULT FALSE,
    subject_minimum_percentage  NUMERIC(5,2)
                                    CHECK (subject_minimum_percentage IS NULL
                                        OR (subject_minimum_percentage >= 0
                                            AND subject_minimum_percentage <= 100)),
    created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT academic_year_dates_check CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_status ON public.academic_years(status);

-- =============================================================================
-- 4. CLASS PROGRESSION MAP
-- =============================================================================

-- Director-editable map: what class a student moves to after passing.
-- is_final=true means graduating (e.g. XII -> graduation).
-- Section letter carries over by default; overriding to a fixed section is optional.
CREATE TABLE IF NOT EXISTS public.class_progression (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_class          TEXT NOT NULL,          -- e.g. 'XI'
    to_class            TEXT,                   -- NULL when is_final=true (graduation, no next class)
    is_final            BOOLEAN NOT NULL DEFAULT FALSE,
    override_section    TEXT,                   -- if set, override section letter (e.g. 'B')
    created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT class_progression_unique_from UNIQUE (from_class),
    CONSTRAINT class_progression_final_check CHECK (
        (is_final = TRUE)
        OR (is_final = FALSE AND to_class IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_class_progression_from ON public.class_progression(from_class);

DROP TRIGGER IF EXISTS trg_class_progression_updated_at ON public.class_progression;
CREATE TRIGGER trg_class_progression_updated_at
    BEFORE UPDATE ON public.class_progression
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- 5. FINAL RESULTS (per-subject marks for year-end promotion)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.final_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id    UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    student_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject             TEXT NOT NULL,
    marks_obtained      NUMERIC(7,2) NOT NULL CHECK (marks_obtained >= 0),
    max_marks           NUMERIC(7,2) NOT NULL CHECK (max_marks > 0),
    entered_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT final_results_marks_check CHECK (marks_obtained <= max_marks),
    CONSTRAINT final_results_unique UNIQUE (academic_year_id, student_id, subject)
);

CREATE INDEX IF NOT EXISTS idx_final_results_year_student ON public.final_results(academic_year_id, student_id);
CREATE INDEX IF NOT EXISTS idx_final_results_student ON public.final_results(student_id);
CREATE INDEX IF NOT EXISTS idx_final_results_year ON public.final_results(academic_year_id);

DROP TRIGGER IF EXISTS trg_final_results_updated_at ON public.final_results;
CREATE TRIGGER trg_final_results_updated_at
    BEFORE UPDATE ON public.final_results
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- 6. PROMOTION RECORDS (permanent audit history, never deleted)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.promotion_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id    UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    student_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    from_class_section  TEXT NOT NULL,
    to_class_section    TEXT,                   -- NULL when graduated
    aggregate_percentage NUMERIC(6,2),
    outcome             public.promotion_outcome NOT NULL,
    override_reason     TEXT,                   -- mandatory when outcome starts with 'override_'
    decided_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT promotion_records_unique UNIQUE (academic_year_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_records_year ON public.promotion_records(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_promotion_records_student ON public.promotion_records(student_id);

-- =============================================================================
-- 7. ROW LEVEL SECURITY — ENABLE ON ALL NEW TABLES
-- =============================================================================

ALTER TABLE public.academic_years      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_progression   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_records   ENABLE ROW LEVEL SECURITY;

-- ---- academic_years -------------------------------------------------------

CREATE POLICY "academic_years_select_authenticated"
    ON public.academic_years FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "academic_years_insert_director_only"
    ON public.academic_years FOR INSERT
    TO authenticated
    WITH CHECK (public.is_director());

CREATE POLICY "academic_years_update_director_only"
    ON public.academic_years FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

-- No DELETE policy — academic years are permanent records.

-- ---- class_progression ----------------------------------------------------

CREATE POLICY "class_progression_select_authenticated"
    ON public.class_progression FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "class_progression_insert_director_only"
    ON public.class_progression FOR INSERT
    TO authenticated
    WITH CHECK (public.is_director());

CREATE POLICY "class_progression_update_director_only"
    ON public.class_progression FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

CREATE POLICY "class_progression_delete_director_only"
    ON public.class_progression FOR DELETE
    TO authenticated
    USING (public.is_director());

-- ---- final_results --------------------------------------------------------
-- Helper function to determine if the current user is a teacher for a given student.
-- Teachers can INSERT/UPDATE only for their own class_section AND only while year is active.

-- Director: full access
CREATE POLICY "final_results_select_director"
    ON public.final_results FOR SELECT
    TO authenticated
    USING (public.is_director());

-- Students: own results only
CREATE POLICY "final_results_select_own_student"
    ON public.final_results FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

-- Teachers: SELECT results for students in their class sections only
CREATE POLICY "final_results_select_teacher"
    ON public.final_results FOR SELECT
    TO authenticated
    USING (
        public.is_teacher()
        AND public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = final_results.student_id)
        )
    );

-- Teachers: INSERT final results only for their class AND while year is active
CREATE POLICY "final_results_insert_teacher"
    ON public.final_results FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_director()
        OR (
            public.is_teacher()
            AND public.is_teacher_of(
                (SELECT p.class_section FROM public.profiles p WHERE p.id = final_results.student_id)
            )
            AND EXISTS (
                SELECT 1 FROM public.academic_years ay
                WHERE ay.id = final_results.academic_year_id
                  AND ay.status = 'active'
            )
        )
    );

-- Teachers: UPDATE final results only for their class AND while year is active
CREATE POLICY "final_results_update_teacher"
    ON public.final_results FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR (
            public.is_teacher()
            AND public.is_teacher_of(
                (SELECT p.class_section FROM public.profiles p WHERE p.id = final_results.student_id)
            )
            AND EXISTS (
                SELECT 1 FROM public.academic_years ay
                WHERE ay.id = final_results.academic_year_id
                  AND ay.status = 'active'
            )
        )
    )
    WITH CHECK (
        public.is_director()
        OR (
            public.is_teacher()
            AND public.is_teacher_of(
                (SELECT p.class_section FROM public.profiles p WHERE p.id = final_results.student_id)
            )
            AND EXISTS (
                SELECT 1 FROM public.academic_years ay
                WHERE ay.id = final_results.academic_year_id
                  AND ay.status = 'active'
            )
        )
    );

-- ---- promotion_records ----------------------------------------------------
-- Permanent history. No DELETE policy. Directors INSERT/UPDATE. Students SELECT own.

CREATE POLICY "promotion_records_select_director"
    ON public.promotion_records FOR SELECT
    TO authenticated
    USING (public.is_director());

CREATE POLICY "promotion_records_select_own_student"
    ON public.promotion_records FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "promotion_records_insert_director_only"
    ON public.promotion_records FOR INSERT
    TO authenticated
    WITH CHECK (public.is_director());

CREATE POLICY "promotion_records_update_director_only"
    ON public.promotion_records FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

-- =============================================================================
-- 8. GRANT EXECUTE PERMISSIONS (so PostgREST can call via RPC)
-- =============================================================================

-- Functions created below are SECURITY DEFINER — no additional RLS needed.
-- Grants are deferred to after function creation (section 9).

-- =============================================================================
-- 9. PROMOTION LOGIC FUNCTIONS (SECURITY DEFINER, director-checked internally)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 9a. preview_promotion(year_id UUID)
--     Returns a table showing the projected outcome for every student.
--     READS ONLY — writes nothing to the database.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_promotion(p_year_id UUID)
RETURNS TABLE (
    student_id          UUID,
    full_name           TEXT,
    from_class_section  TEXT,
    aggregate_percentage NUMERIC,
    outcome             TEXT,       -- 'promoted' | 'held_back' | 'graduated' | 'needs_attention'
    subject_failed      TEXT,       -- first failing subject (if subject minimum failed)
    missing_subjects    TEXT[]      -- subjects with no result row
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year              RECORD;
    v_student           RECORD;
    v_agg               NUMERIC;
    v_outcome           TEXT;
    v_fail_subject      TEXT;
    v_missing           TEXT[];
    v_progression       RECORD;
    v_subjects_entered  TEXT[];
    v_all_subjects      TEXT[];
BEGIN
    -- Director-only guard
    IF NOT public.is_director() THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can preview promotions.';
    END IF;

    -- Fetch year config
    SELECT * INTO v_year FROM public.academic_years WHERE id = p_year_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic year not found: %', p_year_id;
    END IF;

    -- Iterate over every active student who has AT LEAST one final result for this year,
    -- OR who is an active student with a class_section (may have zero results).
    <<student_loop>>
    FOR v_student IN
        SELECT DISTINCT p.id AS sid, p.full_name AS sname, p.class_section AS cs
        FROM public.profiles p
        WHERE p.role = 'student'
          AND p.status = 'active'
          AND p.class_section IS NOT NULL
          AND (
              -- Has at least one result row for this year
              EXISTS (
                  SELECT 1 FROM public.final_results fr
                  WHERE fr.academic_year_id = p_year_id AND fr.student_id = p.id
              )
              -- OR override record already exists (from override_promotion)
              OR EXISTS (
                  SELECT 1 FROM public.promotion_records pr
                  WHERE pr.academic_year_id = p_year_id AND pr.student_id = p.id
              )
          )
    LOOP
        -- Get distinct subjects entered for this student in this year
        SELECT ARRAY_AGG(fr.subject ORDER BY fr.subject)
        INTO v_subjects_entered
        FROM public.final_results fr
        WHERE fr.academic_year_id = p_year_id AND fr.student_id = v_student.sid;

        v_subjects_entered := COALESCE(v_subjects_entered, ARRAY[]::TEXT[]);

        -- Compute aggregate
        SELECT
            CASE
                WHEN SUM(fr.max_marks) > 0
                THEN ROUND(SUM(fr.marks_obtained) / SUM(fr.max_marks) * 100.0, 2)
                ELSE 0
            END
        INTO v_agg
        FROM public.final_results fr
        WHERE fr.academic_year_id = p_year_id AND fr.student_id = v_student.sid;

        v_agg := COALESCE(v_agg, 0);

        -- Detect missing subjects: compare against peer class roster
        -- "Missing" = subjects entered by other students in same class but not this student
        SELECT ARRAY_AGG(DISTINCT peer_fr.subject ORDER BY peer_fr.subject)
        INTO v_all_subjects
        FROM public.final_results peer_fr
        JOIN public.profiles peer_p ON peer_p.id = peer_fr.student_id
        WHERE peer_fr.academic_year_id = p_year_id
          AND peer_p.class_section = v_student.cs;

        v_all_subjects := COALESCE(v_all_subjects, ARRAY[]::TEXT[]);

        -- Missing = in v_all_subjects but not in v_subjects_entered
        SELECT ARRAY_AGG(s ORDER BY s)
        INTO v_missing
        FROM UNNEST(v_all_subjects) s
        WHERE s <> ALL(v_subjects_entered);

        v_missing := COALESCE(v_missing, ARRAY[]::TEXT[]);

        -- If already overridden, report override outcome
        BEGIN
            SELECT pr.outcome
            INTO v_outcome
            FROM public.promotion_records pr
            WHERE pr.academic_year_id = p_year_id AND pr.student_id = v_student.sid
              AND pr.outcome IN ('override_promoted', 'override_held_back');

            IF FOUND THEN
                student_id          := v_student.sid;
                full_name           := v_student.sname;
                from_class_section  := v_student.cs;
                aggregate_percentage := v_agg;
                outcome             := v_outcome::TEXT;
                subject_failed      := NULL;
                missing_subjects    := v_missing;
                RETURN NEXT;
                CONTINUE student_loop;
            END IF;
        END;

        -- needs_attention if missing subjects
        IF array_length(v_missing, 1) > 0 THEN
            student_id          := v_student.sid;
            full_name           := v_student.sname;
            from_class_section  := v_student.cs;
            aggregate_percentage := v_agg;
            outcome             := 'needs_attention';
            subject_failed      := NULL;
            missing_subjects    := v_missing;
            RETURN NEXT;
            CONTINUE;
        END IF;

        -- Determine outcome
        v_fail_subject := NULL;
        v_outcome := 'promoted'; -- optimistic default

        -- Aggregate threshold check
        IF v_agg < v_year.pass_percentage THEN
            v_outcome := 'held_back';
        END IF;

        -- Subject minimum check (if enabled)
        IF v_outcome = 'promoted' AND v_year.require_subject_minimum AND v_year.subject_minimum_percentage IS NOT NULL THEN
            SELECT fr.subject
            INTO v_fail_subject
            FROM public.final_results fr
            WHERE fr.academic_year_id = p_year_id
              AND fr.student_id = v_student.sid
              AND (fr.marks_obtained / fr.max_marks * 100.0) < v_year.subject_minimum_percentage
            ORDER BY fr.subject
            LIMIT 1;

            IF FOUND THEN
                v_outcome := 'held_back';
            END IF;
        END IF;

        -- Check graduation (passed + is_final class)
        IF v_outcome = 'promoted' THEN
            -- Extract base class (e.g. 'XII' from 'XII-B')
            SELECT cp.*
            INTO v_progression
            FROM public.class_progression cp
            WHERE cp.from_class = SPLIT_PART(v_student.cs, '-', 1);

            IF FOUND AND v_progression.is_final THEN
                v_outcome := 'graduated';
            END IF;
        END IF;

        student_id          := v_student.sid;
        full_name           := v_student.sname;
        from_class_section  := v_student.cs;
        aggregate_percentage := v_agg;
        outcome             := v_outcome;
        subject_failed      := v_fail_subject;
        missing_subjects    := v_missing;
        RETURN NEXT;
    END LOOP;

    RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9b. finalize_promotion(year_id UUID)
--     Runs in a single transaction.
--     - Refuses if any student has missing subjects (unless overridden).
--     - Writes promotion_records.
--     - Updates profiles.class_section and profiles.status.
--     - Closes the academic year.
--     - Writes an audit log row.
--     - Idempotent: re-running on a closed year returns immediately.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_promotion(p_year_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year              RECORD;
    v_student           RECORD;
    v_agg               NUMERIC;
    v_outcome           public.promotion_outcome;
    v_fail_subject      TEXT;
    v_missing           TEXT[];
    v_all_subjects      TEXT[];
    v_subjects_entered  TEXT[];
    v_progression       RECORD;
    v_to_class_section  TEXT;
    v_base_class        TEXT;
    v_section_letter    TEXT;

    v_promoted_count    INTEGER := 0;
    v_held_back_count   INTEGER := 0;
    v_graduated_count   INTEGER := 0;
    v_override_count    INTEGER := 0;
    v_needs_attention   TEXT[]  := ARRAY[]::TEXT[];

    v_existing_record   RECORD;
BEGIN
    -- Director-only guard
    IF NOT public.is_director() THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can finalize promotions.';
    END IF;

    -- Fetch year config
    SELECT * INTO v_year FROM public.academic_years WHERE id = p_year_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic year not found: %', p_year_id;
    END IF;

    -- IDEMPOTENCY: if already closed, do nothing and return
    IF v_year.status = 'closed' THEN
        RETURN jsonb_build_object(
            'status', 'already_closed',
            'message', 'Year ' || v_year.label || ' is already closed. Finalize was a no-op.'
        );
    END IF;

    -- -----------------------------------------------------------------------
    -- PASS 1: Collect all students to process and check for missing marks.
    -- -----------------------------------------------------------------------
    FOR v_student IN
        SELECT DISTINCT p.id AS sid, p.full_name AS sname, p.class_section AS cs
        FROM public.profiles p
        WHERE p.role = 'student'
          AND p.status = 'active'
          AND p.class_section IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM public.final_results fr
              WHERE fr.academic_year_id = p_year_id AND fr.student_id = p.id
          )
        -- also include students with override records who may not have final_results
        UNION
        SELECT DISTINCT p.id AS sid, p.full_name AS sname, p.class_section AS cs
        FROM public.profiles p
        JOIN public.promotion_records pr ON pr.student_id = p.id
        WHERE p.role = 'student'
          AND pr.academic_year_id = p_year_id
          AND pr.outcome IN ('override_promoted', 'override_held_back')
    LOOP
        -- Skip override students in missing-check — they are explicitly resolved
        SELECT * INTO v_existing_record
        FROM public.promotion_records pr
        WHERE pr.academic_year_id = p_year_id AND pr.student_id = v_student.sid;

        IF FOUND AND v_existing_record.outcome IN ('override_promoted', 'override_held_back') THEN
            CONTINUE;
        END IF;

        -- Subjects entered by this student
        SELECT ARRAY_AGG(fr.subject ORDER BY fr.subject)
        INTO v_subjects_entered
        FROM public.final_results fr
        WHERE fr.academic_year_id = p_year_id AND fr.student_id = v_student.sid;
        v_subjects_entered := COALESCE(v_subjects_entered, ARRAY[]::TEXT[]);

        -- All subjects for this class section
        SELECT ARRAY_AGG(DISTINCT peer_fr.subject ORDER BY peer_fr.subject)
        INTO v_all_subjects
        FROM public.final_results peer_fr
        JOIN public.profiles peer_p ON peer_p.id = peer_fr.student_id
        WHERE peer_fr.academic_year_id = p_year_id
          AND peer_p.class_section = v_student.cs;
        v_all_subjects := COALESCE(v_all_subjects, ARRAY[]::TEXT[]);

        -- Missing = in class subjects but not entered for this student
        SELECT ARRAY_AGG(s ORDER BY s)
        INTO v_missing
        FROM UNNEST(v_all_subjects) s
        WHERE s <> ALL(v_subjects_entered);
        v_missing := COALESCE(v_missing, ARRAY[]::TEXT[]);

        IF array_length(v_missing, 1) > 0 THEN
            v_needs_attention := array_append(
                v_needs_attention,
                v_student.sname || ' (' || v_student.cs || '): missing ' || array_to_string(v_missing, ', ')
            );
        END IF;
    END LOOP;

    -- Refuse to run if any students have missing marks
    IF array_length(v_needs_attention, 1) > 0 THEN
        RAISE EXCEPTION 'Finalization blocked: % student(s) have missing marks. Resolve or use override_promotion() first. Details: %',
            array_length(v_needs_attention, 1),
            array_to_string(v_needs_attention, ' | ');
    END IF;

    -- -----------------------------------------------------------------------
    -- PASS 2: Apply promotions in one transaction.
    -- -----------------------------------------------------------------------
    FOR v_student IN
        SELECT DISTINCT p.id AS sid, p.full_name AS sname, p.class_section AS cs
        FROM public.profiles p
        WHERE p.role = 'student'
          AND p.status = 'active'
          AND p.class_section IS NOT NULL
          AND (
              EXISTS (
                  SELECT 1 FROM public.final_results fr
                  WHERE fr.academic_year_id = p_year_id AND fr.student_id = p.id
              )
              OR EXISTS (
                  SELECT 1 FROM public.promotion_records pr
                  WHERE pr.academic_year_id = p_year_id AND pr.student_id = p.id
                    AND pr.outcome IN ('override_promoted', 'override_held_back')
              )
          )
    LOOP
        -- Check for existing override record
        SELECT * INTO v_existing_record
        FROM public.promotion_records pr
        WHERE pr.academic_year_id = p_year_id AND pr.student_id = v_student.sid;

        IF FOUND AND v_existing_record.outcome IN ('override_promoted', 'override_held_back') THEN
            -- Honour the override — apply the class change accordingly
            IF v_existing_record.outcome = 'override_promoted' THEN
                -- Progress the student per class_progression
                v_base_class := SPLIT_PART(v_student.cs, '-', 1);
                v_section_letter := SPLIT_PART(v_student.cs, '-', 2);

                SELECT * INTO v_progression
                FROM public.class_progression cp
                WHERE cp.from_class = v_base_class;

                IF FOUND AND NOT v_progression.is_final THEN
                    v_to_class_section := v_progression.to_class || '-'
                        || COALESCE(v_progression.override_section, v_section_letter);

                    UPDATE public.profiles
                    SET class_section = v_to_class_section
                    WHERE id = v_student.sid;
                ELSIF FOUND AND v_progression.is_final THEN
                    -- Graduate
                    UPDATE public.profiles
                    SET status = 'graduated'
                    WHERE id = v_student.sid;
                    v_to_class_section := NULL;
                ELSE
                    v_to_class_section := v_student.cs; -- no progression defined, leave as-is
                END IF;

                -- Update the existing override record with applied to_class_section
                UPDATE public.promotion_records
                SET to_class_section = v_to_class_section
                WHERE id = v_existing_record.id;
            END IF;
            -- override_held_back: no class change needed

            v_override_count := v_override_count + 1;
            CONTINUE;
        END IF;

        -- Normal determination
        SELECT
            CASE
                WHEN SUM(fr.max_marks) > 0
                THEN ROUND(SUM(fr.marks_obtained) / SUM(fr.max_marks) * 100.0, 2)
                ELSE 0
            END
        INTO v_agg
        FROM public.final_results fr
        WHERE fr.academic_year_id = p_year_id AND fr.student_id = v_student.sid;
        v_agg := COALESCE(v_agg, 0);

        -- Determine base outcome
        IF v_agg < v_year.pass_percentage THEN
            v_outcome := 'held_back';
        ELSE
            v_outcome := 'promoted';
        END IF;

        -- Subject minimum check
        IF v_outcome = 'promoted' AND v_year.require_subject_minimum AND v_year.subject_minimum_percentage IS NOT NULL THEN
            SELECT fr.subject
            INTO v_fail_subject
            FROM public.final_results fr
            WHERE fr.academic_year_id = p_year_id
              AND fr.student_id = v_student.sid
              AND (fr.marks_obtained / fr.max_marks * 100.0) < v_year.subject_minimum_percentage
            LIMIT 1;

            IF FOUND THEN
                v_outcome := 'held_back';
            END IF;
        END IF;

        -- Compute destination class section
        v_to_class_section := NULL;
        v_base_class := SPLIT_PART(v_student.cs, '-', 1);
        v_section_letter := SPLIT_PART(v_student.cs, '-', 2);

        IF v_outcome = 'promoted' THEN
            SELECT * INTO v_progression
            FROM public.class_progression cp
            WHERE cp.from_class = v_base_class;

            IF FOUND THEN
                IF v_progression.is_final THEN
                    -- Graduate
                    v_outcome := 'graduated';
                    v_to_class_section := NULL;

                    UPDATE public.profiles
                    SET status = 'graduated'
                    WHERE id = v_student.sid;
                ELSE
                    v_to_class_section := v_progression.to_class || '-'
                        || COALESCE(v_progression.override_section, v_section_letter);

                    UPDATE public.profiles
                    SET class_section = v_to_class_section
                    WHERE id = v_student.sid;
                END IF;
            ELSE
                -- No progression rule defined — treat as held_back to be safe
                v_outcome := 'held_back';
            END IF;
        END IF;
        -- held_back: class_section unchanged, no profile update needed

        -- Write promotion record (upsert to handle re-run safety)
        INSERT INTO public.promotion_records (
            academic_year_id,
            student_id,
            from_class_section,
            to_class_section,
            aggregate_percentage,
            outcome,
            decided_by,
            created_at
        )
        VALUES (
            p_year_id,
            v_student.sid,
            v_student.cs,
            v_to_class_section,
            v_agg,
            v_outcome,
            auth.uid(),
            timezone('utc', now())
        )
        ON CONFLICT (academic_year_id, student_id)
        DO UPDATE SET
            to_class_section    = EXCLUDED.to_class_section,
            aggregate_percentage = EXCLUDED.aggregate_percentage,
            outcome             = EXCLUDED.outcome,
            decided_by          = EXCLUDED.decided_by;

        -- Tally counters
        IF v_outcome = 'promoted'     THEN v_promoted_count  := v_promoted_count  + 1;
        ELSIF v_outcome = 'held_back' THEN v_held_back_count := v_held_back_count + 1;
        ELSIF v_outcome = 'graduated' THEN v_graduated_count := v_graduated_count + 1;
        END IF;
    END LOOP;

    -- -----------------------------------------------------------------------
    -- Close the academic year
    -- -----------------------------------------------------------------------
    UPDATE public.academic_years
    SET status = 'closed'
    WHERE id = p_year_id;

    -- -----------------------------------------------------------------------
    -- Audit log
    -- -----------------------------------------------------------------------
    INSERT INTO public.audit_logs (actor_id, action, device, created_at)
    VALUES (
        auth.uid(),
        'Finalized promotion for ' || v_year.label || ': '
            || v_promoted_count  || ' promoted, '
            || v_held_back_count || ' held back, '
            || v_graduated_count || ' graduated, '
            || v_override_count  || ' overrides applied.',
        'Director Console',
        timezone('utc', now())
    );

    RETURN jsonb_build_object(
        'status',           'success',
        'year',             v_year.label,
        'promoted',         v_promoted_count,
        'held_back',        v_held_back_count,
        'graduated',        v_graduated_count,
        'override_applied', v_override_count
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9c. override_promotion(student_id, year_id, new_outcome, reason)
--     Director-only. Reason is mandatory.
--     Writes/updates promotion_records with override outcome + reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.override_promotion(
    p_student_id    UUID,
    p_year_id       UUID,
    p_new_outcome   TEXT,   -- 'override_promoted' | 'override_held_back'
    p_reason        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year      RECORD;
    v_student   RECORD;
    v_agg       NUMERIC;
    v_outcome   public.promotion_outcome;
BEGIN
    -- Director-only guard
    IF NOT public.is_director() THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can override promotions.';
    END IF;

    -- Validate outcome value
    IF p_new_outcome NOT IN ('override_promoted', 'override_held_back') THEN
        RAISE EXCEPTION 'Invalid outcome: %. Must be override_promoted or override_held_back.', p_new_outcome;
    END IF;

    -- Reason is mandatory
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Override reason is mandatory and cannot be empty.';
    END IF;

    -- Validate year exists
    SELECT * INTO v_year FROM public.academic_years WHERE id = p_year_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic year not found: %', p_year_id;
    END IF;

    -- Validate student exists and is active
    SELECT * INTO v_student FROM public.profiles p
    WHERE p.id = p_student_id AND p.role = 'student';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found or not a student role: %', p_student_id;
    END IF;

    v_outcome := p_new_outcome::public.promotion_outcome;

    -- Compute current aggregate (may be 0 if no results yet)
    SELECT
        CASE WHEN SUM(fr.max_marks) > 0
             THEN ROUND(SUM(fr.marks_obtained) / SUM(fr.max_marks) * 100.0, 2)
             ELSE 0 END
    INTO v_agg
    FROM public.final_results fr
    WHERE fr.academic_year_id = p_year_id AND fr.student_id = p_student_id;
    v_agg := COALESCE(v_agg, 0);

    -- Upsert promotion record
    INSERT INTO public.promotion_records (
        academic_year_id,
        student_id,
        from_class_section,
        to_class_section,
        aggregate_percentage,
        outcome,
        override_reason,
        decided_by,
        created_at
    )
    VALUES (
        p_year_id,
        p_student_id,
        v_student.class_section,
        NULL,           -- to_class_section will be resolved on finalize_promotion
        v_agg,
        v_outcome,
        p_reason,
        auth.uid(),
        timezone('utc', now())
    )
    ON CONFLICT (academic_year_id, student_id)
    DO UPDATE SET
        outcome         = EXCLUDED.outcome,
        override_reason = EXCLUDED.override_reason,
        decided_by      = EXCLUDED.decided_by;

    -- Audit log
    INSERT INTO public.audit_logs (actor_id, action, device, created_at)
    VALUES (
        auth.uid(),
        'Override promotion for student ' || v_student.full_name || ' (' || v_student.class_section || ')'
            || ' in year ' || v_year.label
            || ': outcome=' || p_new_outcome
            || ', reason=' || p_reason,
        'Director Console',
        timezone('utc', now())
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9d. undo_finalize(year_id UUID)
--     Director-only. Allowed only while no subsequent academic year is active.
--     Restores every student's previous class_section from promotion_records.
--     Re-opens the academic year (status='active').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.undo_finalize(p_year_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year          RECORD;
    v_rec           RECORD;
    v_restored      INTEGER := 0;
    v_un_graduated  INTEGER := 0;
BEGIN
    -- Director-only guard
    IF NOT public.is_director() THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can undo finalization.';
    END IF;

    -- Fetch year
    SELECT * INTO v_year FROM public.academic_years WHERE id = p_year_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic year not found: %', p_year_id;
    END IF;

    IF v_year.status != 'closed' THEN
        RAISE EXCEPTION 'Academic year % is not closed. Undo is only allowed on closed years.', v_year.label;
    END IF;

    -- Guard: another year must not be active yet
    IF EXISTS (
        SELECT 1 FROM public.academic_years
        WHERE status = 'active' AND id != p_year_id
    ) THEN
        RAISE EXCEPTION 'Undo blocked: A newer academic year is already active. Undo is only permitted before the next year is activated.';
    END IF;

    -- Restore each student's class_section from from_class_section in promotion_records
    FOR v_rec IN
        SELECT pr.*, p.status AS cur_status
        FROM public.promotion_records pr
        JOIN public.profiles p ON p.id = pr.student_id
        WHERE pr.academic_year_id = p_year_id
    LOOP
        -- Restore class section to from_class_section
        UPDATE public.profiles
        SET class_section = v_rec.from_class_section,
            status = CASE WHEN v_rec.outcome = 'graduated' THEN 'active' ELSE status END
        WHERE id = v_rec.student_id;

        IF v_rec.outcome = 'graduated' THEN
            v_un_graduated := v_un_graduated + 1;
        END IF;

        -- Keep promotion_records intact (permanent ledger) — do not delete.
        v_restored := v_restored + 1;
    END LOOP;

    -- Re-open the academic year
    UPDATE public.academic_years
    SET status = 'active'
    WHERE id = p_year_id;

    -- Audit log
    INSERT INTO public.audit_logs (actor_id, action, device, created_at)
    VALUES (
        auth.uid(),
        'Undid finalization for year ' || v_year.label || ': '
            || v_restored || ' student(s) restored, '
            || v_un_graduated || ' un-graduated.',
        'Director Console',
        timezone('utc', now())
    );

    RETURN jsonb_build_object(
        'status',          'undone',
        'year',            v_year.label,
        'students_restored', v_restored,
        'un_graduated',    v_un_graduated
    );
END;
$$;

-- =============================================================================
-- 10. GRANT EXECUTE ON FUNCTIONS TO authenticated ROLE
-- =============================================================================

REVOKE ALL ON FUNCTION public.preview_promotion(UUID)                        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_promotion(UUID)                       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.override_promotion(UUID, UUID, TEXT, TEXT)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_finalize(UUID)                            FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.preview_promotion(UUID)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_promotion(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.override_promotion(UUID, UUID, TEXT, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_finalize(UUID)                         TO authenticated;

-- =============================================================================
-- 11. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_promotion_records_year_outcome
    ON public.promotion_records(academic_year_id, outcome);
