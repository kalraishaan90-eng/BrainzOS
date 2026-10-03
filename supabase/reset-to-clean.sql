-- =============================================================================
-- BrainzOS — Database Reset to Clean Production Baseline (DEVELOPMENT ONLY)
-- =============================================================================
-- WARNING: DANGEROUS SCRIPT!
-- This script completely erases all user accounts, students, faculty, grades,
-- attendance records, audit logs, and documents.
-- It keeps the complete database schema, security policies, and enum types,
-- and inserts only foundational reference data (houses & clubs).
--
-- NEVER run this script on an active production school deployment.
-- =============================================================================

BEGIN;

-- Disable triggers temporarily during truncate to avoid FK violations
SET session_replication_role = 'replica';

TRUNCATE TABLE 
    public.assignment_submissions,
    public.assignments,
    public.attendance_records,
    public.student_notes,
    public.audit_logs,
    public.broadcasts,
    public.final_results,
    public.promotion_records,
    public.class_progression,
    public.academic_years,
    public.grades,
    public.leave_records,
    public.lecture_plans,
    public.person_documents,
    public.test_schedule,
    public.timetable_entries,
    public.venture_votes,
    public.ventures,
    public.profiles,
    auth.users
CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- -----------------------------------------------------------------------------
-- FOUNDATIONAL INSTITUTIONAL REFERENCE DATA (Houses & Clubs)
-- -----------------------------------------------------------------------------

-- Insert the 4 Standard School Houses with clean 0 points baseline
INSERT INTO public.houses (id, name, color, points) VALUES
    ('11111111-1111-1111-1111-111111111101', 'Nalanda', '#6A8EAE', 0),
    ('11111111-1111-1111-1111-111111111102', 'Takshashila', '#8E7C68', 0),
    ('11111111-1111-1111-1111-111111111103', 'Vikramshila', '#D4C9B7', 0),
    ('11111111-1111-1111-1111-111111111104', 'Vallabhi', '#9EBBAF', 0)
ON CONFLICT (id) DO UPDATE SET points = 0;

-- Insert Standard Institutional Activity Clubs
INSERT INTO public.clubs (id, name, description, category, faculty_lead_id) VALUES
    ('22222222-2222-2222-2222-222222222201', 'Computational Sciences & AI Club', 'Algorithmic computing, competitive coding, and neural network applications.', 'Technology', NULL),
    ('22222222-2222-2222-2222-222222222202', 'Commerce & Financial Analytics Forum', 'Capital markets, macroeconomics, and institutional enterprise incubation.', 'Commerce', NULL),
    ('22222222-2222-2222-2222-222222222203', 'Model United Nations & Parliamentary Debate', 'Diplomatic negotiation, international policy, and public rhetoric.', 'Humanities', NULL)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification Notice
DO $$
BEGIN
    RAISE NOTICE 'BrainzOS database wiped clean. Foundational houses and clubs initialized with 0 points. Database is ready for one-time bootstrap-director.';
END $$;
