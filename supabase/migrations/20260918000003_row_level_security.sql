-- =============================================================================
-- Migration: 20260918000003_row_level_security.sql
-- Description: Row Level Security (RLS) Policies across all BrainzOS tables
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- Enable RLS on every table
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 1. HOUSES & CLUBS POLICIES
-- Readable by all authenticated users; modified only by Directors
-- -----------------------------------------------------------------------------

CREATE POLICY "houses_select_all_authenticated"
    ON public.houses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "houses_modify_director_only"
    ON public.houses FOR ALL
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

CREATE POLICY "clubs_select_all_authenticated"
    ON public.clubs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "clubs_modify_director_only"
    ON public.clubs FOR ALL
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

-- -----------------------------------------------------------------------------
-- 2. PROFILES POLICIES
-- Readable by all authenticated users (for names, avatars, rosters)
-- Editable only by the profile owner. (Role changes protected by trigger)
-- -----------------------------------------------------------------------------

CREATE POLICY "profiles_select_all_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "profiles_update_own_profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_director_full_access"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

-- -----------------------------------------------------------------------------
-- 3. TIMETABLE ENTRIES POLICIES
-- Readable by all authenticated users
-- Writable only by teachers of the class or directors
-- -----------------------------------------------------------------------------

CREATE POLICY "timetable_select_all_authenticated"
    ON public.timetable_entries FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "timetable_insert_teacher_or_director"
    ON public.timetable_entries FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_director()
        OR public.is_teacher_of(class_section)
    );

CREATE POLICY "timetable_update_teacher_or_director"
    ON public.timetable_entries FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR public.is_teacher_of(class_section)
    )
    WITH CHECK (
        public.is_director()
        OR public.is_teacher_of(class_section)
    );

CREATE POLICY "timetable_delete_director_only"
    ON public.timetable_entries FOR DELETE
    TO authenticated
    USING (public.is_director());

-- -----------------------------------------------------------------------------
-- 4. ATTENDANCE RECORDS POLICIES
-- Student: SELECT own records only
-- Teacher: SELECT / INSERT / UPDATE records for students in their assigned class
-- Director: Full access (SELECT all, audit corrections)
-- -----------------------------------------------------------------------------

CREATE POLICY "attendance_select_policy"
    ON public.attendance_records FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = attendance_records.student_id)
        )
    );

CREATE POLICY "attendance_insert_teacher_or_director"
    ON public.attendance_records FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_director()
        OR (
            public.is_teacher_of(
                (SELECT p.class_section FROM public.profiles p WHERE p.id = attendance_records.student_id)
            )
            AND (marked_by IS NULL OR marked_by = auth.uid())
        )
    );

CREATE POLICY "attendance_update_teacher_or_director"
    ON public.attendance_records FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = attendance_records.student_id)
        )
    )
    WITH CHECK (
        public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = attendance_records.student_id)
        )
    );

CREATE POLICY "attendance_delete_director_only"
    ON public.attendance_records FOR DELETE
    TO authenticated
    USING (public.is_director());

-- -----------------------------------------------------------------------------
-- 5. ASSIGNMENTS POLICIES
-- Readable by all authenticated users
-- Writable only by teachers (for their own class) or directors
-- -----------------------------------------------------------------------------

CREATE POLICY "assignments_select_all_authenticated"
    ON public.assignments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "assignments_insert_teacher_or_director"
    ON public.assignments FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_director()
        OR (
            public.is_teacher_of(class_section)
            AND created_by = auth.uid()
        )
    );

CREATE POLICY "assignments_update_teacher_or_director"
    ON public.assignments FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR (created_by = auth.uid() AND public.is_teacher_of(class_section))
    )
    WITH CHECK (
        public.is_director()
        OR (created_by = auth.uid() AND public.is_teacher_of(class_section))
    );

CREATE POLICY "assignments_delete_teacher_or_director"
    ON public.assignments FOR DELETE
    TO authenticated
    USING (
        public.is_director()
        OR (created_by = auth.uid() AND public.is_teacher_of(class_section))
    );

-- -----------------------------------------------------------------------------
-- 6. ASSIGNMENT SUBMISSIONS POLICIES
-- Student: SELECT own, INSERT/UPDATE own completion status
-- Teacher: SELECT / UPDATE submissions for their class
-- Director: Full access
-- -----------------------------------------------------------------------------

CREATE POLICY "submissions_select_policy"
    ON public.assignment_submissions FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = assignment_submissions.student_id)
        )
    );

CREATE POLICY "submissions_insert_policy"
    ON public.assignment_submissions FOR INSERT
    TO authenticated
    WITH CHECK (
        student_id = auth.uid()
        OR public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = assignment_submissions.student_id)
        )
    );

CREATE POLICY "submissions_update_policy"
    ON public.assignment_submissions FOR UPDATE
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = assignment_submissions.student_id)
        )
    )
    WITH CHECK (
        student_id = auth.uid()
        OR public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = assignment_submissions.student_id)
        )
    );

-- -----------------------------------------------------------------------------
-- 7. GRADES POLICIES
-- Student: SELECT own grades only
-- Teacher: SELECT / INSERT / UPDATE grades for their students
-- Director: Full access
-- -----------------------------------------------------------------------------

CREATE POLICY "grades_select_policy"
    ON public.grades FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid()
        OR public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = grades.student_id)
        )
    );

CREATE POLICY "grades_insert_teacher_or_director"
    ON public.grades FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = grades.student_id)
        )
    );

CREATE POLICY "grades_update_teacher_or_director"
    ON public.grades FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = grades.student_id)
        )
    )
    WITH CHECK (
        public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = grades.student_id)
        )
    );

CREATE POLICY "grades_delete_teacher_or_director"
    ON public.grades FOR DELETE
    TO authenticated
    USING (
        public.is_director()
        OR public.is_teacher_of(
            (SELECT p.class_section FROM public.profiles p WHERE p.id = grades.student_id)
        )
    );

-- -----------------------------------------------------------------------------
-- 8. VENTURES POLICIES (Pitch Pad)
-- Readable by all authenticated users
-- INSERT allowed only by founder (founder_id = auth.uid()) with initial pending status
-- UPDATE of directors_pick or status allowed ONLY if role = 'director'
-- UPDATE of venture details allowed by founder
-- Votes counter is strictly maintained via trigger from venture_votes
-- -----------------------------------------------------------------------------

CREATE POLICY "ventures_select_all_authenticated"
    ON public.ventures FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "ventures_insert_founder_only"
    ON public.ventures FOR INSERT
    TO authenticated
    WITH CHECK (
        founder_id = auth.uid()
        AND status = 'pending'::public.venture_status
        AND directors_pick = FALSE
        AND votes = 0
    );

-- Director can update any field (approvals, rejection, director's pick flag)
CREATE POLICY "ventures_update_director"
    ON public.ventures FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

-- Founder can update their pitch description/tags, but CANNOT change status or directors_pick
CREATE POLICY "ventures_update_founder_details"
    ON public.ventures FOR UPDATE
    TO authenticated
    USING (
        founder_id = auth.uid()
        AND NOT public.is_director()
    )
    WITH CHECK (
        founder_id = auth.uid()
        AND status = (SELECT v.status FROM public.ventures v WHERE v.id = ventures.id)
        AND directors_pick = (SELECT v.directors_pick FROM public.ventures v WHERE v.id = ventures.id)
    );

CREATE POLICY "ventures_delete_founder_or_director"
    ON public.ventures FOR DELETE
    TO authenticated
    USING (
        founder_id = auth.uid()
        OR public.is_director()
    );

-- -----------------------------------------------------------------------------
-- 9. VENTURE VOTES POLICIES
-- Readable by all authenticated users (to verify voting status)
-- Student can INSERT / DELETE only their own vote row (student_id = auth.uid())
-- -----------------------------------------------------------------------------

CREATE POLICY "venture_votes_select_all_authenticated"
    ON public.venture_votes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "venture_votes_insert_own_only"
    ON public.venture_votes FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "venture_votes_delete_own_only"
    ON public.venture_votes FOR DELETE
    TO authenticated
    USING (student_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 10. BROADCASTS POLICIES
-- Readable by all authenticated users
-- Writable only by teachers (published_by = auth.uid()) or directors
-- -----------------------------------------------------------------------------

CREATE POLICY "broadcasts_select_all_authenticated"
    ON public.broadcasts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "broadcasts_insert_teacher_or_director"
    ON public.broadcasts FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_director()
        OR (public.is_teacher() AND published_by = auth.uid())
    );

CREATE POLICY "broadcasts_update_teacher_or_director"
    ON public.broadcasts FOR UPDATE
    TO authenticated
    USING (
        public.is_director()
        OR (published_by = auth.uid() AND public.is_teacher())
    )
    WITH CHECK (
        public.is_director()
        OR (published_by = auth.uid() AND public.is_teacher())
    );

CREATE POLICY "broadcasts_delete_teacher_or_director"
    ON public.broadcasts FOR DELETE
    TO authenticated
    USING (
        public.is_director()
        OR (published_by = auth.uid() AND public.is_teacher())
    );

-- -----------------------------------------------------------------------------
-- 11. AUDIT LOGS POLICIES
-- SELECT allowed ONLY for role = 'director'
-- INSERT allowed for any authenticated user for their own actions (actor_id = auth.uid()) or system
-- UPDATE / DELETE prohibited (immutable ledger)
-- -----------------------------------------------------------------------------

CREATE POLICY "audit_logs_select_director_only"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_director());

CREATE POLICY "audit_logs_insert_authenticated"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        actor_id IS NULL
        OR actor_id = auth.uid()
    );

-- -----------------------------------------------------------------------------
-- 12. EMERGENCY EVENTS POLICIES
-- SELECT allowed ONLY for role = 'director'
-- INSERT allowed for any authenticated user (triggered_by = auth.uid())
-- -----------------------------------------------------------------------------

CREATE POLICY "emergency_events_select_director_only"
    ON public.emergency_events FOR SELECT
    TO authenticated
    USING (public.is_director());

CREATE POLICY "emergency_events_insert_authenticated"
    ON public.emergency_events FOR INSERT
    TO authenticated
    WITH CHECK (triggered_by = auth.uid());

CREATE POLICY "emergency_events_delete_director_only"
    ON public.emergency_events FOR DELETE
    TO authenticated
    USING (public.is_director());
