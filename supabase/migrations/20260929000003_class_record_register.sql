-- =============================================================================
-- Migration: 20260929000002_class_record_register.sql
-- Description: Class Record Register (Confidential Staff Notes, View & RLS)
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- =============================================================================
-- PRIVACY & COMPLIANCE ARCHITECTURE NOTE:
-- In a production secondary school deployment, student notes contain sensitive
-- data concerning minors. The institution must institute a comprehensive Data
-- Privacy Policy and define a statutory data retention and expungement schedule
-- (e.g. archiving or hard deletion after graduation/transfer plus 3 years under
-- CBSE and national DPDP regulations). Health and welfare observations are
-- strictly partitioned so that only the recording author and the School
-- Director can access them. Students and guardians have zero read permissions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE: student_notes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'academic',
        'behaviour',
        'attendance',
        'health_welfare',
        'achievement',
        'parent_contact',
        'general'
    )),
    note TEXT NOT NULL CHECK (char_length(note) > 0 AND char_length(note) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance & relational lookup indexes
CREATE INDEX IF NOT EXISTS idx_student_notes_student_id ON public.student_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_author_id ON public.student_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_category ON public.student_notes(category);
CREATE INDEX IF NOT EXISTS idx_student_notes_created_at ON public.student_notes(created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. TRIGGER: Maintain updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_student_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_notes_updated_at ON public.student_notes;
CREATE TRIGGER trg_student_notes_updated_at
BEFORE UPDATE ON public.student_notes
FOR EACH ROW EXECUTE FUNCTION public.handle_student_notes_updated_at();

-- -----------------------------------------------------------------------------
-- 3. AUDIT LOGGING TRIGGER: Every insert/edit/delete writes to public.audit_logs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_student_notes_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_action TEXT;
    v_student_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT full_name INTO v_student_name FROM public.profiles WHERE id = NEW.student_id;
        v_action := 'Created ' || NEW.category || ' note for student ' || COALESCE(v_student_name, NEW.student_id::text);
        INSERT INTO public.audit_logs (actor_id, action, device, created_at)
        VALUES (
            COALESCE(v_actor_id, NEW.author_id),
            v_action,
            'Class Record Register',
            timezone('utc'::text, now())
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT full_name INTO v_student_name FROM public.profiles WHERE id = NEW.student_id;
        v_action := 'Updated ' || NEW.category || ' note for student ' || COALESCE(v_student_name, NEW.student_id::text);
        INSERT INTO public.audit_logs (actor_id, action, device, created_at)
        VALUES (
            COALESCE(v_actor_id, NEW.author_id),
            v_action,
            'Class Record Register',
            timezone('utc'::text, now())
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT full_name INTO v_student_name FROM public.profiles WHERE id = OLD.student_id;
        v_action := 'Deleted ' || OLD.category || ' note for student ' || COALESCE(v_student_name, OLD.student_id::text);
        INSERT INTO public.audit_logs (actor_id, action, device, created_at)
        VALUES (
            COALESCE(v_actor_id, OLD.author_id),
            v_action,
            'Class Record Register',
            timezone('utc'::text, now())
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_notes_audit ON public.student_notes;
CREATE TRIGGER trg_student_notes_audit
AFTER INSERT OR UPDATE OR DELETE ON public.student_notes
FOR EACH ROW EXECUTE FUNCTION public.handle_student_notes_audit();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) FOR student_notes
-- -----------------------------------------------------------------------------
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if migration is re-run
DROP POLICY IF EXISTS "student_notes_director_all" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_director_select" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_director_insert" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_director_update" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_director_delete" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_teacher_select_standard" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_teacher_select_health_welfare" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_teacher_insert" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_teacher_update" ON public.student_notes;
DROP POLICY IF EXISTS "student_notes_teacher_delete" ON public.student_notes;

-- 4.1 DIRECTOR POLICIES: Director can SELECT all notes, and edit/delete any note
CREATE POLICY "student_notes_director_select"
    ON public.student_notes FOR SELECT
    TO authenticated
    USING (public.is_director());

CREATE POLICY "student_notes_director_insert"
    ON public.student_notes FOR INSERT
    TO authenticated
    WITH CHECK (public.is_director());

CREATE POLICY "student_notes_director_update"
    ON public.student_notes FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

CREATE POLICY "student_notes_director_delete"
    ON public.student_notes FOR DELETE
    TO authenticated
    USING (public.is_director());

-- 4.2 TEACHER POLICIES:
-- a) INSERT: Teacher can insert notes only for students in a class_section they teach
CREATE POLICY "student_notes_teacher_insert"
    ON public.student_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_teacher()
        AND author_id = auth.uid()
        AND public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = student_notes.student_id)
        )
    );

-- b) SELECT (Standard): Teacher can select standard notes for students in sections they teach
CREATE POLICY "student_notes_teacher_select_standard"
    ON public.student_notes FOR SELECT
    TO authenticated
    USING (
        public.is_teacher()
        AND category != 'health_welfare'
        AND public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = student_notes.student_id)
        )
    );

-- c) SELECT (Health & Welfare): Health_welfare notes visible only to author and director (director covered above)
CREATE POLICY "student_notes_teacher_select_health_welfare"
    ON public.student_notes FOR SELECT
    TO authenticated
    USING (
        public.is_teacher()
        AND category = 'health_welfare'
        AND author_id = auth.uid()
        AND public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = student_notes.student_id)
        )
    );

-- d) UPDATE: Teachers can update only notes they authored for their students
CREATE POLICY "student_notes_teacher_update"
    ON public.student_notes FOR UPDATE
    TO authenticated
    USING (
        public.is_teacher()
        AND author_id = auth.uid()
        AND public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = student_notes.student_id)
        )
    )
    WITH CHECK (
        public.is_teacher()
        AND author_id = auth.uid()
        AND public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = student_notes.student_id)
        )
    );

-- e) DELETE: Teachers can delete only notes they authored for their students
CREATE POLICY "student_notes_teacher_delete"
    ON public.student_notes FOR DELETE
    TO authenticated
    USING (
        public.is_teacher()
        AND author_id = auth.uid()
        AND public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = student_notes.student_id)
        )
    );

-- (Students have no policies on student_notes; RLS denies all student access)

-- -----------------------------------------------------------------------------
-- 5. POSTGRES VIEW: student_record_summary
-- -----------------------------------------------------------------------------
-- Summarizes attendance %, present/late/absent counts, grade averages by category,
-- and count of notes per student in a single query.
-- Enforces that teachers only see students from their own class sections, and
-- director sees all. Students cannot access any rows.
CREATE OR REPLACE VIEW public.student_record_summary
WITH (security_barrier = true)
AS
SELECT
    p.id AS student_id,
    p.full_name,
    p.student_id_code,
    p.class_section,
    p.stream,
    p.house_id,
    h.name AS house_name,
    p.avatar_url,
    COALESCE(u.email, lower(replace(p.full_name, ' ', '.')) || '@brainz.edu') AS email,
    -- Attendance statistics
    COALESCE(att.total_records, 0)::INTEGER AS total_attendance_records,
    COALESCE(att.present_count, 0)::INTEGER AS present_count,
    COALESCE(att.late_count, 0)::INTEGER AS late_count,
    COALESCE(att.absent_count, 0)::INTEGER AS absent_count,
    ROUND(
        CASE
            WHEN COALESCE(att.total_records, 0) > 0 THEN
                ((COALESCE(att.present_count, 0) + COALESCE(att.late_count, 0))::NUMERIC / att.total_records::NUMERIC) * 100.0
            ELSE 100.0
        END,
        1
    ) AS attendance_percentage,
    -- Grade averages by category
    ROUND(COALESCE(grd.quiz_avg, 0)::NUMERIC, 1) AS quiz_average,
    ROUND(COALESCE(grd.case_study_avg, 0)::NUMERIC, 1) AS case_study_average,
    ROUND(COALESCE(grd.presentation_avg, 0)::NUMERIC, 1) AS presentation_average,
    ROUND(COALESCE(grd.overall_avg, 0)::NUMERIC, 1) AS overall_grade_average,
    -- Staff notes count
    COALESCE(sn.notes_count, 0)::INTEGER AS notes_count
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.houses h ON h.id = p.house_id
LEFT JOIN (
    SELECT
        student_id,
        COUNT(*)::INTEGER AS total_records,
        COUNT(*) FILTER (WHERE status = 'present')::INTEGER AS present_count,
        COUNT(*) FILTER (WHERE status = 'late')::INTEGER AS late_count,
        COUNT(*) FILTER (WHERE status = 'absent')::INTEGER AS absent_count
    FROM public.attendance_records
    GROUP BY student_id
) att ON att.student_id = p.id
LEFT JOIN (
    SELECT
        student_id,
        AVG(CASE WHEN max_score > 0 THEN (score / max_score) * 100.0 ELSE NULL END) AS overall_avg,
        AVG(CASE WHEN category = 'quiz' AND max_score > 0 THEN (score / max_score) * 100.0 ELSE NULL END) AS quiz_avg,
        AVG(CASE WHEN category = 'case_study' AND max_score > 0 THEN (score / max_score) * 100.0 ELSE NULL END) AS case_study_avg,
        AVG(CASE WHEN category = 'presentation' AND max_score > 0 THEN (score / max_score) * 100.0 ELSE NULL END) AS presentation_avg
    FROM public.grades
    GROUP BY student_id
) grd ON grd.student_id = p.id
LEFT JOIN (
    SELECT
        student_id,
        COUNT(*)::INTEGER AS notes_count
    FROM public.student_notes
    GROUP BY student_id
) sn ON sn.student_id = p.id
WHERE p.role = 'student'
  AND (
      public.is_director()
      OR (public.is_teacher() AND public.is_teacher_of(p.class_section))
  );

-- Permissions
REVOKE ALL ON public.student_notes FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_notes TO authenticated;

REVOKE ALL ON public.student_record_summary FROM PUBLIC;
GRANT SELECT ON public.student_record_summary TO authenticated;

-- Realtime Setup for student_notes
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_notes;
    END IF;
EXCEPTION
    WHEN others THEN null;
END $$;
