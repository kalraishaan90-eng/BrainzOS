-- =============================================================================
-- Migration: 20260927000002_teacher_student_profile_edit.sql
-- Description: Teacher Student Profile Editing Policy, Guard Trigger, and Audit Logging
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CONFIRM/UPDATE is_teacher_of(target_class_section TEXT) HELPER
-- -----------------------------------------------------------------------------
-- Evaluates home section assignment, timetable schedule, or assignment creation.
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
-- 2. RLS UPDATE POLICY ON profiles FOR TEACHERS
-- -----------------------------------------------------------------------------
-- Teachers can UPDATE students in class sections they teach.
-- Target row role must be 'student', and the teacher must teach target class_section.
-- Role cannot be escalated or changed to non-student.
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
    );

-- -----------------------------------------------------------------------------
-- 3. FIELD PROTECTION TRIGGER: RESTRICT UNMODIFIABLE FIELDS
-- -----------------------------------------------------------------------------
-- Restricts teachers from modifying role, id, or auth-linked fields (e.g. email).
-- Permits teachers to edit: full_name, class_section, stream, house_id, student_id_code, avatar_url.
-- Prevents non-teachers/students from modifying class_section, student_id_code, role, etc.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Directors have full authorization across all profile records
    IF public.is_director() THEN
        RETURN NEW;
    END IF;

    -- 2. Primary key ID is strictly immutable
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Permission Denied: User profile ID is strictly immutable.';
    END IF;

    -- 3. Role cannot be modified by any non-director (prevents privilege escalation)
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Permission Denied: Cannot modify user role (from % to %). Role changes require Director authorization.', OLD.role, NEW.role;
    END IF;

    -- 4. Auth-linked fields (e.g., email) cannot be altered on public.profiles
    IF (to_jsonb(NEW) ? 'email') AND ((to_jsonb(NEW) ->> 'email') IS DISTINCT FROM (to_jsonb(OLD) ->> 'email')) THEN
        RAISE EXCEPTION 'Permission Denied: Cannot modify auth-linked email address.';
    END IF;

    -- 5. Teacher editing student profile
    IF public.is_teacher() AND OLD.role = 'student' THEN
        -- Teacher must teach this student's class section
        IF OLD.class_section IS NULL OR NOT public.is_teacher_of(OLD.class_section) THEN
            RAISE EXCEPTION 'Permission Denied: Teachers can only edit profile details of students in classes they teach (section: %)', OLD.class_section;
        END IF;

        -- Target role must strictly remain student
        IF NEW.role != 'student' THEN
            RAISE EXCEPTION 'Permission Denied: Student role cannot be altered.';
        END IF;

        -- Editable student fields: full_name, class_section, stream, house_id, student_id_code, avatar_url
        -- Protect immutable creation timestamp
        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            NEW.created_at := OLD.created_at;
        END IF;

        -- Set updated_at timestamp
        NEW.updated_at := timezone('utc'::text, now());
        RETURN NEW;
    END IF;

    -- 6. Students modifying their own profile (or other non-teacher/non-director users)
    IF OLD.role = 'student' THEN
        IF NEW.class_section IS DISTINCT FROM OLD.class_section THEN
            RAISE EXCEPTION 'Permission Denied: Students cannot modify their class section.';
        END IF;
        IF NEW.student_id_code IS DISTINCT FROM OLD.student_id_code THEN
            RAISE EXCEPTION 'Permission Denied: Students cannot modify their institutional student ID.';
        END IF;
        IF NEW.class_group IS DISTINCT FROM OLD.class_group AND NEW.class_section IS NOT DISTINCT FROM OLD.class_section THEN
            RAISE EXCEPTION 'Permission Denied: Students cannot modify class group.';
        END IF;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_unauthorized_profile_modifications ON public.profiles;

CREATE TRIGGER trg_prevent_unauthorized_profile_modifications
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_profile_modifications();

-- -----------------------------------------------------------------------------
-- 4. AUDIT LOGGING TRIGGER FOR TEACHER STUDENT PROFILE EDITS
-- -----------------------------------------------------------------------------
-- Every edit of a student profile by a teacher inserts a row into public.audit_logs:
-- (actor_id = teacher, action = "Edited student profile: <field changed>", device = navigator.userAgent).
CREATE OR REPLACE FUNCTION public.log_student_profile_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    changed_fields TEXT[] := ARRAY[]::TEXT[];
    action_text TEXT;
    device_info TEXT;
    actor UUID;
BEGIN
    actor := auth.uid();

    -- Only audit when a student profile is edited by an authorized user (teacher or administrative non-self)
    IF OLD.role = 'student' AND (public.is_teacher() OR actor IS DISTINCT FROM OLD.id) THEN
        IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
            changed_fields := array_append(changed_fields, 'full_name');
        END IF;
        IF NEW.class_section IS DISTINCT FROM OLD.class_section THEN
            changed_fields := array_append(changed_fields, 'class_section');
        END IF;
        IF NEW.stream IS DISTINCT FROM OLD.stream THEN
            changed_fields := array_append(changed_fields, 'stream');
        END IF;
        IF NEW.house_id IS DISTINCT FROM OLD.house_id THEN
            changed_fields := array_append(changed_fields, 'house_id');
        END IF;
        IF NEW.student_id_code IS DISTINCT FROM OLD.student_id_code THEN
            changed_fields := array_append(changed_fields, 'student_id_code');
        END IF;
        IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
            changed_fields := array_append(changed_fields, 'avatar_url');
        END IF;

        -- If at least one student profile field was changed
        IF array_length(changed_fields, 1) > 0 THEN
            action_text := 'Edited student profile: ' || array_to_string(changed_fields, ', ');

            -- Extract User-Agent header passed through PostgREST request headers if available
            BEGIN
                device_info := current_setting('request.headers', true)::json->>'user-agent';
            EXCEPTION WHEN OTHERS THEN
                device_info := NULL;
            END;

            IF device_info IS NULL OR device_info = '' THEN
                device_info := 'Web Console';
            END IF;

            INSERT INTO public.audit_logs (actor_id, action, device, created_at)
            VALUES (
                actor,
                action_text,
                device_info,
                timezone('utc'::text, now())
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_student_profile_edit ON public.profiles;

CREATE TRIGGER trg_audit_student_profile_edit
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_student_profile_audit();
