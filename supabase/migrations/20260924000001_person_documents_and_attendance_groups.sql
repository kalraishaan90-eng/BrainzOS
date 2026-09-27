-- =============================================================================
-- Migration: 20260924000001_person_documents_and_attendance_groups.sql
-- Description:
--   1. Document Storage: Private Supabase Storage bucket 'person-documents'
--      and 'person_documents' metadata table with Director & Owner RLS.
--   2. Class-Group Tagging: 'class_group' ENUM, column on profiles, and one-time
--      backfill mapping class_section to grade bands.
--   3. Daily Attendance by Group: Aggregated Postgres view 'daily_attendance_by_group'.
--   4. Student Edit Permissions: Teacher RLS UPDATE policy on student profiles
--      scoped to assigned class sections (excluding role & class_section changes).
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- =============================================================================
-- 1. DOCUMENT STORAGE: BUCKET & PERSON_DOCUMENTS TABLE
-- =============================================================================

-- 1.1 Create private Supabase Storage bucket 'person-documents'
-- Insert bucket record if it does not already exist; ensure it is private (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'person-documents',
    'person-documents',
    FALSE,
    52428800, -- 50 MB file size limit
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE;

-- 1.2 Create person_documents metadata table
CREATE TABLE IF NOT EXISTS public.person_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_documents_owner_id ON public.person_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_person_documents_uploaded_by ON public.person_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_person_documents_storage_path ON public.person_documents(storage_path);

-- Enable RLS on person_documents
ALTER TABLE public.person_documents ENABLE ROW LEVEL SECURITY;

-- 1.3 RLS Policies on public.person_documents
-- Rule: Director can SELECT, INSERT, UPDATE, DELETE all rows.
-- Rule: Student or Teacher can SELECT only rows where owner_id = auth.uid() (their own docs).
-- Rule: No INSERT, UPDATE, or DELETE for students or teachers in this pass.

DROP POLICY IF EXISTS "person_documents_director_full_access" ON public.person_documents;
CREATE POLICY "person_documents_director_full_access"
    ON public.person_documents FOR ALL
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "person_documents_owner_select" ON public.person_documents;
CREATE POLICY "person_documents_owner_select"
    ON public.person_documents FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

-- 1.4 Storage Object RLS Policies on storage.objects for 'person-documents' bucket
-- Storage objects must mirror the database rules:
-- - Read: Only a director or the document owner (referenced in person_documents) can read/download.
-- - Write: Only a director (the uploader) can upload, update, or delete objects.

DROP POLICY IF EXISTS "person_documents_storage_select" ON storage.objects;
CREATE POLICY "person_documents_storage_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'person-documents'
        AND (
            public.is_director()
            OR EXISTS (
                SELECT 1 FROM public.person_documents pd
                WHERE pd.storage_path = storage.objects.name
                  AND pd.owner_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "person_documents_storage_insert" ON storage.objects;
CREATE POLICY "person_documents_storage_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'person-documents'
        AND public.is_director()
    );

DROP POLICY IF EXISTS "person_documents_storage_update" ON storage.objects;
CREATE POLICY "person_documents_storage_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'person-documents'
        AND public.is_director()
    )
    WITH CHECK (
        bucket_id = 'person-documents'
        AND public.is_director()
    );

DROP POLICY IF EXISTS "person_documents_storage_delete" ON storage.objects;
CREATE POLICY "person_documents_storage_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'person-documents'
        AND public.is_director()
    );

-- Add to Realtime publication for live UI reactivity
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.person_documents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- 2. CLASS-GROUP TAGGING FOR ATTENDANCE
-- =============================================================================

-- 2.1 Create class_group ENUM type
DO $$ BEGIN
    CREATE TYPE public.class_group AS ENUM ('elementary', 'primary', 'secondary', 'high');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2.2 Add class_group column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS class_group public.class_group;

-- Create index for group-level filtering and view aggregation
CREATE INDEX IF NOT EXISTS idx_profiles_class_group ON public.profiles(class_group);

-- -----------------------------------------------------------------------------
-- 2.3 One-Time Backfill: Map class_section ranges to class_group
-- -----------------------------------------------------------------------------
-- MAPPING SPECIFICATION & GRADE BAND RATIONALE:
-- -----------------------------------------------------------------------------
-- Grade Band      | Standard Grades   | Class Section Patterns / Nomenclature
-- ----------------|-------------------|---------------------------------------
-- 'elementary'    | Pre-K to Grade 5  | I-V, 1-5, KG, NUR, PREP
--                 |                   | (e.g., 'I-A', 'II-B', 'III-A', 'IV-C', 'V-B', '1-A'..'5-B')
-- 'primary'       | Grades 6 to 8     | VI-VIII, 6-8 (Middle School / Upper Primary)
--                 |                   | (e.g., 'VI-A', 'VII-B', 'VIII-A', '6-A'..'8-B')
-- 'secondary'     | Grades 9 and 10   | IX-X, 9-10 (Secondary Board Exam Cohort)
--                 |                   | (e.g., 'IX-A', 'IX-B', 'X-A', 'X-B', '9-A'..'10-B')
-- 'high'          | Grades 11 and 12  | XI-XII, 11-12 (Senior Secondary / High School)
--                 |                   | (e.g., 'XI-A', 'XI-B', 'XII-A', 'XII-B', '11-A'..'12-B')
-- -----------------------------------------------------------------------------
-- NOTE FOR SCHOOL ADMIN: If the school uses custom section tags (e.g., 'Montessori',
-- 'O-Level', 'A-Level'), modify or append them to the corresponding WHEN clauses below.
-- -----------------------------------------------------------------------------

UPDATE public.profiles
SET class_group = CASE
    -- 1. High School / Senior Secondary (Grades 11 & 12: XI, XII, 11, 12)
    WHEN class_section ~* '^(XI|XII|11|12)([- ]|$)'
      OR class_section ILIKE 'XI-%'
      OR class_section ILIKE 'XII-%'
      OR class_section ILIKE '11-%'
      OR class_section ILIKE '12-%'
      THEN 'high'::public.class_group

    -- 2. Secondary School (Grades 9 & 10: IX, X, 9, 10)
    WHEN class_section ~* '^(IX|X|9|10)([- ]|$)'
      OR class_section ILIKE 'IX-%'
      OR class_section ILIKE 'X-%'
      OR class_section ILIKE '9-%'
      OR class_section ILIKE '10-%'
      THEN 'secondary'::public.class_group

    -- 3. Primary / Middle School (Grades 6 to 8: VI, VII, VIII, 6, 7, 8)
    WHEN class_section ~* '^(VI|VII|VIII|6|7|8)([- ]|$)'
      OR class_section ILIKE 'VI-%'
      OR class_section ILIKE 'VII-%'
      OR class_section ILIKE 'VIII-%'
      OR class_section ILIKE '6-%'
      OR class_section ILIKE '7-%'
      OR class_section ILIKE '8-%'
      THEN 'primary'::public.class_group

    -- 4. Elementary School (Grades 1 to 5 & Kindergarten: I-V, 1-5, KG, NUR, PREP)
    WHEN class_section ~* '^(I|II|III|IV|V|1|2|3|4|5)([- ]|$)'
      OR class_section ILIKE 'I-%'
      OR class_section ILIKE 'II-%'
      OR class_section ILIKE 'III-%'
      OR class_section ILIKE 'IV-%'
      OR class_section ILIKE 'V-%'
      OR class_section ILIKE '1-%'
      OR class_section ILIKE '2-%'
      OR class_section ILIKE '3-%'
      OR class_section ILIKE '4-%'
      OR class_section ILIKE '5-%'
      OR class_section ILIKE 'KG%'
      OR class_section ILIKE 'NUR%'
      OR class_section ILIKE 'PREP%'
      THEN 'elementary'::public.class_group

    -- Fallback default for unmatched student cohorts (defaults to 'high' for BrainzOS core XI/XII cohort)
    ELSE 'high'::public.class_group
END
WHERE role = 'student'
  AND class_section IS NOT NULL;

-- 2.4 Trigger to auto-assign class_group on future student profile creation/updates
CREATE OR REPLACE FUNCTION public.handle_auto_assign_class_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role = 'student' AND NEW.class_section IS NOT NULL AND NEW.class_group IS NULL THEN
        NEW.class_group := CASE
            WHEN NEW.class_section ~* '^(XI|XII|11|12)([- ]|$)' OR NEW.class_section ILIKE 'XI-%' OR NEW.class_section ILIKE 'XII-%' OR NEW.class_section ILIKE '11-%' OR NEW.class_section ILIKE '12-%' THEN 'high'::public.class_group
            WHEN NEW.class_section ~* '^(IX|X|9|10)([- ]|$)' OR NEW.class_section ILIKE 'IX-%' OR NEW.class_section ILIKE 'X-%' OR NEW.class_section ILIKE '9-%' OR NEW.class_section ILIKE '10-%' THEN 'secondary'::public.class_group
            WHEN NEW.class_section ~* '^(VI|VII|VIII|6|7|8)([- ]|$)' OR NEW.class_section ILIKE 'VI-%' OR NEW.class_section ILIKE 'VII-%' OR NEW.class_section ILIKE 'VIII-%' OR NEW.class_section ILIKE '6-%' OR NEW.class_section ILIKE '7-%' OR NEW.class_section ILIKE '8-%' THEN 'primary'::public.class_group
            WHEN NEW.class_section ~* '^(I|II|III|IV|V|1|2|3|4|5)([- ]|$)' OR NEW.class_section ILIKE 'I-%' OR NEW.class_section ILIKE 'II-%' OR NEW.class_section ILIKE 'III-%' OR NEW.class_section ILIKE 'IV-%' OR NEW.class_section ILIKE 'V-%' OR NEW.class_section ILIKE '1-%' OR NEW.class_section ILIKE '2-%' OR NEW.class_section ILIKE '3-%' OR NEW.class_section ILIKE '4-%' OR NEW.class_section ILIKE '5-%' OR NEW.class_section ILIKE 'KG%' OR NEW.class_section ILIKE 'NUR%' OR NEW.class_section ILIKE 'PREP%' THEN 'elementary'::public.class_group
            ELSE 'high'::public.class_group
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_class_group ON public.profiles;
CREATE TRIGGER trg_auto_assign_class_group
    BEFORE INSERT OR UPDATE OF class_section ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_auto_assign_class_group();


-- =============================================================================
-- 3. POSTGRES VIEW: daily_attendance_by_group
-- =============================================================================

-- Daily attendance summary view aggregated by class_group + date
-- Mirrors daily_attendance_summary shape from Prompt 14 for director dashboard consumption.
CREATE OR REPLACE VIEW public.daily_attendance_by_group
WITH (security_invoker = true)
AS
SELECT
    p.class_group,
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
WHERE p.class_group IS NOT NULL
GROUP BY p.class_group, ar.date;

-- Grant access to authenticated users (data access controlled by underlying RLS via security_invoker)
GRANT SELECT ON public.daily_attendance_by_group TO authenticated;


-- =============================================================================
-- 4. STUDENT EDIT PERMISSIONS (TEACHER SCOPED UPDATE)
-- =============================================================================

-- 4.1 RLS Policy allowing teachers to update students in their assigned classes
-- Reuses is_teacher_of(class_section) from Prompt 10.
-- Guarantees a teacher cannot update any student outside their assigned classes.
DROP POLICY IF EXISTS "profiles_update_teacher_assigned_students" ON public.profiles;
CREATE POLICY "profiles_update_teacher_assigned_students"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        public.is_teacher()
        AND role = 'student'
        AND class_section IS NOT NULL
        AND public.is_teacher_of(class_section)
    )
    WITH CHECK (
        role = 'student'
        AND class_section IS NOT NULL
        AND public.is_teacher_of(class_section)
    );

-- 4.1.1 Keep class_group in sync with class_section.
-- trg_auto_assign_class_group only fires when class_group IS NULL, so a teacher
-- moving a student between sections (e.g. XI-B -> XI-A is blocked, but
-- X-A -> 6-A is allowed for a re-classified student) would silently leave the
-- stale group behind and mis-bucket the student in daily_attendance_by_group.
-- The recompute function intentionally overwrites any manual value on section
-- change; the director-only guard below still protects manual group overrides.
CREATE OR REPLACE FUNCTION public.recompute_class_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role = 'student' AND NEW.class_section IS NOT NULL THEN
        NEW.class_group :=
            CASE
                WHEN NEW.class_section ~* '^(XI|XII|11|12)([- ]|$)' OR NEW.class_section ILIKE 'XI-%' OR NEW.class_section ILIKE 'XII-%' OR NEW.class_section ILIKE '11-%' OR NEW.class_section ILIKE '12-%' THEN 'high'::public.class_group
                WHEN NEW.class_section ~* '^(IX|X|9|10)([- ]|$)' OR NEW.class_section ILIKE 'IX-%' OR NEW.class_section ILIKE 'X-%' OR NEW.class_section ILIKE '9-%' OR NEW.class_section ILIKE '10-%' THEN 'secondary'::public.class_group
                WHEN NEW.class_section ~* '^(VI|VII|VIII|6|7|8)([- ]|$)' OR NEW.class_section ILIKE 'VI-%' OR NEW.class_section ILIKE 'VII-%' OR NEW.class_section ILIKE 'VIII-%' OR NEW.class_section ILIKE '6-%' OR NEW.class_section ILIKE '7-%' OR NEW.class_section ILIKE '8-%' THEN 'primary'::public.class_group
                WHEN NEW.class_section ~* '^(I|II|III|IV|V|1|2|3|4|5)([- ]|$)' OR NEW.class_section ILIKE 'I-%' OR NEW.class_section ILIKE 'II-%' OR NEW.class_section ILIKE 'III-%' OR NEW.class_section ILIKE 'IV-%' OR NEW.class_section ILIKE 'V-%' OR NEW.class_section ILIKE '1-%' OR NEW.class_section ILIKE '2-%' OR NEW.class_section ILIKE '3-%' OR NEW.class_section ILIKE '4-%' OR NEW.class_section ILIKE '5-%' OR NEW.class_section ILIKE 'KG%' OR NEW.class_section ILIKE 'NUR%' OR NEW.class_section ILIKE 'PREP%' THEN 'elementary'::public.class_group
                ELSE 'high'::public.class_group
            END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_class_group ON public.profiles;
CREATE TRIGGER trg_recompute_class_group
    BEFORE UPDATE OF class_section ON public.profiles
    FOR EACH ROW
    WHEN (NEW.class_section IS DISTINCT FROM OLD.class_section)
    EXECUTE FUNCTION public.recompute_class_group();

-- 4.2 Field Protection Trigger
-- RLS policies permit the UPDATE statement at row level.
-- To strictly enforce that teachers (and non-directors) CANNOT alter 'role',
-- 'class_section', or 'student_id_code', we extend the BEFORE UPDATE trigger.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If requester is a director, all profile updates are permitted
    IF public.is_director() THEN
        RETURN NEW;
    END IF;

    -- Prevent non-directors from modifying role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can modify user roles (from % to %)', OLD.role, NEW.role;
    END IF;

    -- Prevent non-directors (teachers/students) from modifying a student's class_section
    IF OLD.role = 'student' AND NEW.class_section IS DISTINCT FROM OLD.class_section THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can modify student class_section (from % to %)', OLD.class_section, NEW.class_section;
    END IF;

    -- Prevent non-directors from modifying student_id_code
    IF OLD.role = 'student' AND NEW.student_id_code IS DISTINCT FROM OLD.student_id_code THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can modify student_id_code';
    END IF;

    -- Prevent teachers or students from manually overriding class_group
    -- (class_group is managed automatically from class_section or by director)
    IF OLD.role = 'student' AND NEW.class_group IS DISTINCT FROM OLD.class_group AND NEW.class_section IS NOT DISTINCT FROM OLD.class_section THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can manually reassign class_group';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_unauthorized_profile_modifications ON public.profiles;

CREATE TRIGGER trg_prevent_unauthorized_profile_modifications
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_profile_modifications();
