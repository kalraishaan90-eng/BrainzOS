-- =============================================================================
-- Migration: 20260920000001_features_extension.sql
-- Description: Schema extensions for Attendance Locking, Daily Attendance Summary View,
--              Individual/Group Assignments, Leave Records, Lecture Schedule &
--              Completion Tracking, Substitution System, and Director Stats.
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- =============================================================================
-- 1. ATTENDANCE LOCKING & RLS UPDATE
-- =============================================================================

-- Add locked column to attendance_records (default false)
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index on locked status for quick filtering if needed
CREATE INDEX IF NOT EXISTS idx_attendance_records_locked ON public.attendance_records(locked);

-- Update RLS on attendance_records:
-- Existing policy "attendance_update_teacher_or_director" allowed teachers of the class section
-- or directors to update any row.
-- We replace it so UPDATE is rejected if locked = true UNLESS the requesting user is a director.
-- Boundary note: student_id is NOT NULL (FK to profiles), and is_teacher_of(NULL/unknown)
-- evaluates FALSE, so a row whose student profile was hard-deleted is simply not
-- teacher-editable; directors retain access. Rows cannot exist without a student.
DROP POLICY IF EXISTS "attendance_update_teacher_or_director" ON public.attendance_records;

CREATE POLICY "attendance_update_teacher_or_director"
    ON public.attendance_records FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR (
            locked = FALSE
            AND public.is_teacher_of(
                (SELECT p.class_section FROM public.profiles p WHERE p.id = attendance_records.student_id)
            )
        )
    )
    WITH CHECK (
        public.is_director()
        OR (
            locked = FALSE
            AND public.is_teacher_of(
                (SELECT p.class_section FROM public.profiles p WHERE p.id = attendance_records.student_id)
            )
        )
    );

-- =============================================================================
-- 2. DAILY ATTENDANCE REPORTS (POSTGRES VIEW)
-- =============================================================================

-- Daily attendance summary view aggregating records by class_section + date
-- with present, late, absent counts, total marked, and attendance percentage.
CREATE OR REPLACE VIEW public.daily_attendance_summary
WITH (security_invoker = true)
AS
SELECT
    p.class_section,
    ar.date,
    COUNT(*) FILTER (WHERE ar.status = 'present')::INTEGER AS present_count,
    COUNT(*) FILTER (WHERE ar.status = 'late')::INTEGER AS late_count,
    COUNT(*) FILTER (WHERE ar.status = 'absent')::INTEGER AS absent_count,
    COUNT(*)::INTEGER AS total_students_marked,
    ROUND(
        (COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100.0,
        2
    ) AS attendance_percentage
FROM public.attendance_records ar
JOIN public.profiles p ON p.id = ar.student_id
WHERE p.class_section IS NOT NULL
GROUP BY p.class_section, ar.date;

-- =============================================================================
-- 3. ASSIGNMENTS — INDIVIDUAL OR GROUP
-- =============================================================================

-- Shared security-definer predicate for "who may see / manage assignees of an
-- assignment". The permissive SELECT policies on assignments and
-- assignment_individual_assignees below reference each other's tables
-- (assignments -> assignees via EXISTS, and assignees -> assignments via
-- EXISTS). With invoker-rights subqueries that is mutual recursion: PostgREST
-- fails every query against either table with "infinite recursion detected in
-- policy for relation ...". Evaluating the assignment's class_section /
-- created_by inside a SECURITY DEFINER function breaks the cycle.
CREATE OR REPLACE FUNCTION public.can_manage_assignment_assignees(target_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.id = target_assignment_id
          AND (
              a.created_by = auth.uid()
              OR public.is_director()
              OR public.is_teacher_of(a.class_section)
          )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_assignment_assignees(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_assignment_assignees(UUID) TO authenticated;

-- Create assignee_type ENUM
DO $$ BEGIN
    CREATE TYPE public.assignment_assignee_type AS ENUM ('class', 'individual');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add assignee_type column to assignments table (default 'class')
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS assignee_type public.assignment_assignee_type NOT NULL DEFAULT 'class';

-- Create assignment_individual_assignees table
CREATE TABLE IF NOT EXISTS public.assignment_individual_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_assignment_individual_assignee UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_individual_assignees_assignment
    ON public.assignment_individual_assignees(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_individual_assignees_student
    ON public.assignment_individual_assignees(student_id);

-- Enable RLS on assignment_individual_assignees
ALTER TABLE public.assignment_individual_assignees ENABLE ROW LEVEL SECURITY;

-- RLS for assignment_individual_assignees:
-- Students can select their own assignees rows. Teachers of the assignment and directors can view/manage.
CREATE POLICY "assignment_individual_assignees_select_policy"
    ON public.assignment_individual_assignees FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.can_manage_assignment_assignees(assignment_individual_assignees.assignment_id)
    );

CREATE POLICY "assignment_individual_assignees_insert_teacher_or_director"
    ON public.assignment_individual_assignees FOR INSERT
    TO authenticated
    WITH CHECK (
        public.can_manage_assignment_assignees(assignment_individual_assignees.assignment_id)
    );

CREATE POLICY "assignment_individual_assignees_delete_teacher_or_director"
    ON public.assignment_individual_assignees FOR DELETE
    TO authenticated
    USING (
        public.can_manage_assignment_assignees(assignment_individual_assignees.assignment_id)
    );

-- Update RLS for assignments table:
-- Previously "assignments_select_all_authenticated" had USING (true).
-- Replace it so:
-- 1. Directors can see all assignments.
-- 2. Teachers can see all assignments (or their classes).
-- 3. Students see:
--    - Class-type assignments matching their own class_section
--    - Individual-type assignments ONLY IF they are in assignment_individual_assignees for it.
DROP POLICY IF EXISTS "assignments_select_all_authenticated" ON public.assignments;

CREATE POLICY "assignments_select_policy"
    ON public.assignments FOR SELECT
    TO authenticated
    USING (
        public.is_director()
        OR public.is_teacher()
        OR (
            -- Student access:
            -- Case A: Class-wide assignment matching student's class_section
            (
                assignee_type = 'class'
                AND class_section = (SELECT p.class_section FROM public.profiles p WHERE p.id = auth.uid())
            )
            -- Case B: Individual assignment explicitly assigned to student
            OR (
                assignee_type = 'individual'
                AND EXISTS (
                    SELECT 1 FROM public.assignment_individual_assignees aia
                    WHERE aia.assignment_id = assignments.id
                      AND aia.student_id = auth.uid()
                )
            )
        )
    );

-- =============================================================================
-- 4. LEAVE RECORDS & TEACHER LEAVE SUMMARY
-- =============================================================================

-- Leave type and status ENUMs
DO $$ BEGIN
    CREATE TYPE public.leave_type AS ENUM ('full_day', 'half_day_am', 'half_day_pm');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.leave_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    leave_type public.leave_type NOT NULL,
    reason TEXT,
    status public.leave_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_leave_records_teacher_date ON public.leave_records(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_records_status ON public.leave_records(status);

ALTER TABLE public.leave_records ENABLE ROW LEVEL SECURITY;

-- RLS: A teacher can INSERT/SELECT only their own leave_records.
-- A director can SELECT all, and UPDATE status (approve/reject) on any row.
CREATE POLICY "leave_records_select_policy"
    ON public.leave_records FOR SELECT
    TO authenticated
    USING (
        teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "leave_records_insert_teacher_own"
    ON public.leave_records FOR INSERT
    TO authenticated
    WITH CHECK (
        (teacher_id = auth.uid() AND public.is_teacher())
        OR public.is_director()
    );

CREATE POLICY "leave_records_update_director_only"
    ON public.leave_records FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

CREATE POLICY "leave_records_delete_director_only"
    ON public.leave_records FOR DELETE
    TO authenticated
    USING (public.is_director());

-- View: teacher_leave_summary
-- Rolls up each teacher's total full-day and half-day leave counts for the current academic year.
-- Academic year assumed to start on April 1 (standard school year, or June 1 / configurable).
-- Computed dynamically: If current month >= 4, cycle is April 1 of current year to March 31 of next year;
-- else April 1 of prior year to March 31 of current year.
CREATE OR REPLACE VIEW public.teacher_leave_summary
WITH (security_invoker = true)
AS
WITH academic_year AS (
    SELECT
        CASE
            WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
                make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 4, 1)
            ELSE
                make_date((EXTRACT(YEAR FROM CURRENT_DATE) - 1)::INTEGER, 4, 1)
        END AS start_date,
        CASE
            WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
                make_date((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::INTEGER, 3, 31)
            ELSE
                make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 3, 31)
        END AS end_date
)
SELECT
    p.id AS teacher_id,
    p.full_name AS teacher_name,
    p.student_id_code AS employee_code,
    COUNT(lr.id) FILTER (WHERE lr.status = 'approved' AND lr.leave_type = 'full_day')::INTEGER AS full_day_leaves,
    COUNT(lr.id) FILTER (WHERE lr.status = 'approved' AND lr.leave_type IN ('half_day_am', 'half_day_pm'))::INTEGER AS half_day_leaves,
    (
        COUNT(lr.id) FILTER (WHERE lr.status = 'approved' AND lr.leave_type = 'full_day')
        + (COUNT(lr.id) FILTER (WHERE lr.status = 'approved' AND lr.leave_type IN ('half_day_am', 'half_day_pm')) * 0.5)
    )::NUMERIC(5, 1) AS total_leave_days_taken,
    COUNT(lr.id) FILTER (WHERE lr.status = 'pending')::INTEGER AS pending_requests_count
FROM public.profiles p
CROSS JOIN academic_year ay
LEFT JOIN public.leave_records lr
    ON lr.teacher_id = p.id
    AND lr.date >= ay.start_date
    AND lr.date <= ay.end_date
WHERE p.role = 'teacher'
GROUP BY p.id, p.full_name, p.student_id_code;

-- =============================================================================
-- 5. LECTURE SCHEDULE + COMPLETION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lecture_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_section TEXT NOT NULL,
    subject TEXT NOT NULL,
    date DATE NOT NULL,
    topic TEXT NOT NULL,
    planned BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lecture_plan_teacher_date ON public.lecture_plan(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_lecture_plan_class_section ON public.lecture_plan(class_section, date);

CREATE TABLE IF NOT EXISTS public.lecture_completion (
    lecture_plan_id UUID PRIMARY KEY REFERENCES public.lecture_plan(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.test_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_section TEXT NOT NULL,
    subject TEXT NOT NULL,
    date DATE NOT NULL,
    topic TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_test_schedule_teacher_date ON public.test_schedule(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_test_schedule_class_section ON public.test_schedule(class_section, date);

-- Enable RLS
ALTER TABLE public.lecture_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_schedule ENABLE ROW LEVEL SECURITY;

-- RLS: lecture_plan
CREATE POLICY "lecture_plan_select_policy"
    ON public.lecture_plan FOR SELECT
    TO authenticated
    USING (
        teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "lecture_plan_insert_policy"
    ON public.lecture_plan FOR INSERT
    TO authenticated
    WITH CHECK (
        teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "lecture_plan_update_policy"
    ON public.lecture_plan FOR UPDATE
    TO authenticated
    USING (
        teacher_id = auth.uid()
        OR public.is_director()
    )
    WITH CHECK (
        teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "lecture_plan_delete_policy"
    ON public.lecture_plan FOR DELETE
    TO authenticated
    USING (
        teacher_id = auth.uid()
        OR public.is_director()
    );

-- RLS: lecture_completion
CREATE POLICY "lecture_completion_select_policy"
    ON public.lecture_completion FOR SELECT
    TO authenticated
    USING (
        public.is_director()
        OR EXISTS (
            SELECT 1 FROM public.lecture_plan lp
            WHERE lp.id = lecture_completion.lecture_plan_id
              AND lp.teacher_id = auth.uid()
        )
    );

CREATE POLICY "lecture_completion_insert_policy"
    ON public.lecture_completion FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_director()
        OR EXISTS (
            SELECT 1 FROM public.lecture_plan lp
            WHERE lp.id = lecture_completion.lecture_plan_id
              AND lp.teacher_id = auth.uid()
        )
    );

CREATE POLICY "lecture_completion_update_policy"
    ON public.lecture_completion FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR EXISTS (
            SELECT 1 FROM public.lecture_plan lp
            WHERE lp.id = lecture_completion.lecture_plan_id
              AND lp.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_director()
        OR EXISTS (
            SELECT 1 FROM public.lecture_plan lp
            WHERE lp.id = lecture_completion.lecture_plan_id
              AND lp.teacher_id = auth.uid()
        )
    );

CREATE POLICY "lecture_completion_delete_policy"
    ON public.lecture_completion FOR DELETE
    TO authenticated
    USING (
        public.is_director()
        OR EXISTS (
            SELECT 1 FROM public.lecture_plan lp
            WHERE lp.id = lecture_completion.lecture_plan_id
              AND lp.teacher_id = auth.uid()
        )
    );

-- RLS: test_schedule
CREATE POLICY "test_schedule_select_policy"
    ON public.test_schedule FOR SELECT
    TO authenticated
    USING (
        teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "test_schedule_insert_policy"
    ON public.test_schedule FOR INSERT
    TO authenticated
    WITH CHECK (
        teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "test_schedule_update_policy"
    ON public.test_schedule FOR UPDATE
    TO authenticated
    USING (
        teacher_id = auth.uid()
        OR public.is_director()
    )
    WITH CHECK (
        teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "test_schedule_delete_policy"
    ON public.test_schedule FOR DELETE
    TO authenticated
    USING (
        teacher_id = auth.uid()
        OR public.is_director()
    );

-- =============================================================================
-- 6. SUBSTITUTION SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    substitute_teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_record_id UUID REFERENCES public.leave_records(id) ON DELETE SET NULL,
    class_section TEXT NOT NULL,
    period_number INTEGER NOT NULL CHECK (period_number > 0),
    date DATE NOT NULL,
    lecture_plan_id UUID REFERENCES public.lecture_plan(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_substitutions_substitute_date ON public.substitutions(substitute_teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_substitutions_original_date ON public.substitutions(original_teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_substitutions_date ON public.substitutions(date);

ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT policy must be strictly visible ONLY to substitute_teacher_id and to directors.
-- NOT to original_teacher_id's other colleagues, and not broadly to all teachers.
CREATE POLICY "substitutions_select_policy"
    ON public.substitutions FOR SELECT
    TO authenticated
    USING (
        substitute_teacher_id = auth.uid()
        OR public.is_director()
    );

CREATE POLICY "substitutions_insert_director_only"
    ON public.substitutions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_director());

CREATE POLICY "substitutions_update_director_only"
    ON public.substitutions FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

CREATE POLICY "substitutions_delete_director_only"
    ON public.substitutions FOR DELETE
    TO authenticated
    USING (public.is_director());

-- Also grant substitute teachers permission to read the referenced lecture_plan row
-- so they can inspect the topic and lesson notes for the class they are covering.
CREATE POLICY "lecture_plan_substitute_select_policy"
    ON public.lecture_plan FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.substitutions s
            WHERE s.lecture_plan_id = lecture_plan.id
              AND s.substitute_teacher_id = auth.uid()
        )
    );

-- =============================================================================
-- 7. DIRECTOR ATTENDANCE STAT (VIEW: teacher_attendance_today)
-- =============================================================================

-- Computes present teacher count / total teachers for CURRENT_DATE.
-- A teacher is considered "marked present today" if:
-- 1. They do NOT have an approved leave_record (full_day) for CURRENT_DATE, AND
-- 2. They have either marked attendance for a class today, logged a lecture completion,
--    or have an attendance status if staff attendance is tracked.
-- Alternatively, if leave_records is the negative-assertion system:
-- (total teachers - approved leaves today) / total teachers.
-- We combine both: distinct teachers actively present (or active) vs total teachers.
CREATE OR REPLACE VIEW public.teacher_attendance_today
WITH (security_invoker = true)
AS
WITH teacher_pool AS (
    SELECT id
    FROM public.profiles
    WHERE role = 'teacher'
),
present_teachers AS (
    SELECT DISTINCT tp.id
    FROM teacher_pool tp
    WHERE
        -- Condition 1: No approved full-day leave today
        NOT EXISTS (
            SELECT 1 FROM public.leave_records lr
            WHERE lr.teacher_id = tp.id
              AND lr.date = CURRENT_DATE
              AND lr.status = 'approved'
              AND lr.leave_type = 'full_day'
        )
        -- Condition 2: Marked attendance or active schedule / log today
        AND (
            EXISTS (
                SELECT 1 FROM public.attendance_records ar
                WHERE ar.marked_by = tp.id
                  AND ar.date = CURRENT_DATE
            )
            OR EXISTS (
                SELECT 1 FROM public.lecture_plan lp
                JOIN public.lecture_completion lc ON lc.lecture_plan_id = lp.id
                WHERE lp.teacher_id = tp.id
                  AND lp.date = CURRENT_DATE
                  AND lc.completed = TRUE
            )
            -- If staff attendance is marked in attendance_records directly
            OR EXISTS (
                SELECT 1 FROM public.attendance_records ar
                WHERE ar.student_id = tp.id
                  AND ar.date = CURRENT_DATE
                  AND ar.status IN ('present', 'late')
            )
        )
)
SELECT
    CURRENT_DATE AS report_date,
    (SELECT COUNT(*) FROM present_teachers)::INTEGER AS teachers_present_today,
    (SELECT COUNT(*) FROM teacher_pool)::INTEGER AS total_teachers,
    CONCAT(
        (SELECT COUNT(*) FROM present_teachers)::TEXT,
        '/',
        (SELECT COUNT(*) FROM teacher_pool)::TEXT
    ) AS attendance_stat,
    ROUND(
        (
            (SELECT COUNT(*) FROM present_teachers)::NUMERIC
            / NULLIF((SELECT COUNT(*) FROM teacher_pool)::NUMERIC, 0)
        ) * 100.0,
        2
    ) AS presence_percentage;
