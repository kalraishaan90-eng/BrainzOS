-- =============================================================================
-- Migration: 20260918000001_initial_schema.sql
-- Description: Core Schema for BrainzOS (Types, Tables, Constraints & Indexes)
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- Ensure required crypto extension for UUID and password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'director');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.grade_category AS ENUM ('quiz', 'case_study', 'presentation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.venture_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.emergency_type AS ENUM ('siren', 'silent_test');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 2. HOUSES & CLUBS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 3. PROFILES (Linked to auth.users)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'student',
    class_section TEXT,              -- e.g. "XI-B"
    stream TEXT,                     -- e.g. "Commerce", "Science", "Humanities"
    house_id UUID REFERENCES public.houses(id) ON DELETE SET NULL,
    student_id_code TEXT UNIQUE,      -- e.g. "BOS-XIB-041"
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 4. TIMETABLE ENTRIES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_section TEXT NOT NULL,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    period_number INTEGER NOT NULL CHECK (period_number > 0),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL CHECK (end_time > start_time),
    subject TEXT NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    room TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 5. ATTENDANCE RECORDS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status public.attendance_status NOT NULL DEFAULT 'present',
    check_in_time TIME,
    seat TEXT,                       -- e.g. "B-12"
    marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_student_daily_attendance UNIQUE (student_id, date)
);

-- -----------------------------------------------------------------------------
-- 6. ASSIGNMENTS & SUBMISSIONS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    class_section TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    weightage INTEGER NOT NULL DEFAULT 10 CHECK (weightage >= 0),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_student_assignment_submission UNIQUE (assignment_id, student_id)
);

-- -----------------------------------------------------------------------------
-- 7. GRADES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL, -- nullable for generic/term tests
    category public.grade_category NOT NULL,
    score NUMERIC(5, 2) NOT NULL CHECK (score >= 0),
    max_score NUMERIC(5, 2) NOT NULL CHECK (max_score > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_score_le_max CHECK (score <= max_score)
);

-- -----------------------------------------------------------------------------
-- 8. VENTURES (Pitch Pad) & VENTURE VOTES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ventures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    founder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    votes INTEGER NOT NULL DEFAULT 0 CHECK (votes >= 0),
    directors_pick BOOLEAN NOT NULL DEFAULT FALSE,
    status public.venture_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.venture_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_venture_student_vote UNIQUE (venture_id, student_id)
);

-- -----------------------------------------------------------------------------
-- 9. BROADCASTS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    headline TEXT NOT NULL,
    message TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'Whole School', -- e.g. "XI Commerce", "Whole School", "Staff Only"
    published_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 10. AUDIT LOGS & EMERGENCY EVENTS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- nullable for 'System'
    action TEXT NOT NULL,
    device TEXT NOT NULL DEFAULT 'Web Console',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.emergency_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.emergency_type NOT NULL DEFAULT 'siren',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 11. INDEXES FOR PERFORMANCE & RELATIONAL LOOKUPS
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_class_section ON public.profiles(class_section);
CREATE INDEX IF NOT EXISTS idx_profiles_house ON public.profiles(house_id);

CREATE INDEX IF NOT EXISTS idx_timetable_class_day ON public.timetable_entries(class_section, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON public.timetable_entries(teacher_id);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(date);

CREATE INDEX IF NOT EXISTS idx_assignments_class_due ON public.assignments(class_section, due_date);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assign ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON public.assignment_submissions(student_id);

CREATE INDEX IF NOT EXISTS idx_grades_student ON public.grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_assignment ON public.grades(assignment_id);

CREATE INDEX IF NOT EXISTS idx_ventures_founder ON public.ventures(founder_id);
CREATE INDEX IF NOT EXISTS idx_ventures_status ON public.ventures(status);
CREATE INDEX IF NOT EXISTS idx_venture_votes_venture ON public.venture_votes(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_votes_student ON public.venture_votes(student_id);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON public.broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_events_created_at ON public.emergency_events(created_at DESC);
