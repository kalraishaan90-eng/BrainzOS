-- =============================================================================
-- BrainzOS Seed Data Script
-- File: supabase/seed.sql
-- Description: Realistic initial dataset matching BrainzOS UI mock state
-- Stack: Supabase PostgreSQL
-- Default password for all demo accounts: Password123!
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HOUSES (Points match House Cup Leaderboard in BrainzOS.html)
-- -----------------------------------------------------------------------------

INSERT INTO public.houses (id, name, points) VALUES
    ('11111111-1111-1111-1111-111111111101', 'Phoenix', 1380),
    ('11111111-1111-1111-1111-111111111102', 'Orion', 1240),
    ('11111111-1111-1111-1111-111111111103', 'Pegasus', 1110),
    ('11111111-1111-1111-1111-111111111104', 'Centaurus', 970)
ON CONFLICT (name) DO UPDATE SET
    points = EXCLUDED.points;

-- -----------------------------------------------------------------------------
-- 2. CLUBS & SOCIETIES
-- -----------------------------------------------------------------------------

INSERT INTO public.clubs (id, name, description) VALUES
    ('22222222-2222-2222-2222-222222222201', 'Commerce Club', 'Financial literacy, equity valuation, mock trading competitions, and macroeconomic policy analysis.'),
    ('22222222-2222-2222-2222-222222222202', 'Tech Society', 'Full-stack software engineering, algorithmic competitions, machine learning workshops, and campus hardware projects.'),
    ('22222222-2222-2222-2222-222222222203', 'Debate Society', 'Parliamentary debate, policy motions, forensic speaking, and inter-school championship leagues.'),
    ('22222222-2222-2222-2222-222222222204', 'Model UN', 'Diplomatic negotiation, international affairs, crisis simulation committees, and treaty drafting.')
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description;

-- -----------------------------------------------------------------------------
-- 3. USERS (auth.users & public.profiles)
-- Passwords hashed using bcrypt for "Password123!"
-- -----------------------------------------------------------------------------

-- Helper function to seed auth users idempotently
CREATE OR REPLACE FUNCTION public.seed_user(
    p_id UUID,
    p_email TEXT,
    p_name TEXT,
    p_role public.user_role,
    p_class TEXT DEFAULT NULL,
    p_stream TEXT DEFAULT NULL,
    p_house_id UUID DEFAULT NULL,
    p_code TEXT DEFAULT NULL,
    p_avatar TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Upsert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        p_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        p_email,
        crypt('Password123!', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
            'full_name', p_name,
            'role', p_role,
            'class_section', p_class,
            'stream', p_stream,
            'house_id', p_house_id,
            'student_id_code', p_code,
            'avatar_url', p_avatar
        ),
        now(),
        now(),
        '',
        '',
        '',
        ''
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    -- 2. Upsert into public.profiles
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
        p_id,
        p_name,
        p_role,
        p_class,
        p_stream,
        p_house_id,
        p_code,
        p_avatar
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        class_section = EXCLUDED.class_section,
        stream = EXCLUDED.stream,
        house_id = EXCLUDED.house_id,
        student_id_code = EXCLUDED.student_id_code,
        avatar_url = EXCLUDED.avatar_url;
END;
$$;

-- Seed Principal / Director
SELECT public.seed_user(
    'a0000000-0000-0000-0000-000000000003',
    'director@brainz.edu',
    'Dr. Rhea Sharma',
    'director',
    NULL,
    NULL,
    NULL,
    'DIR-EXE-001',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
);

-- Seed Lead Commerce Faculty (Teacher)
SELECT public.seed_user(
    'a0000000-0000-0000-0000-000000000002',
    'teacher@brainz.edu',
    'Aarav Mehta',
    'teacher',
    'XI-B',
    'Commerce',
    '11111111-1111-1111-1111-111111111102',
    'FAC-COM-014',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
);

-- Seed Core Subject Teachers
SELECT public.seed_user('a0000000-0000-0000-0000-000000000021', 'ananya.sen@brainz.edu', 'Ms. Ananya Sen', 'teacher', 'XI-B', 'Humanities', '11111111-1111-1111-1111-111111111101', 'FAC-ENG-008', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000022', 'sunita.sharma@brainz.edu', 'Mrs. Sunita Sharma', 'teacher', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111103', 'FAC-ACC-012', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000023', 'kabir.roy@brainz.edu', 'Dr. Kabir Roy', 'teacher', 'XI-B', 'Humanities', '11111111-1111-1111-1111-111111111104', 'FAC-POL-005', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000024', 'david.vance@brainz.edu', 'Mr. David Vance', 'teacher', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111102', 'FAC-BST-019', NULL);

-- Seed Primary Demo Student: Ishaan Kalra
SELECT public.seed_user(
    'a0000000-0000-0000-0000-000000000001',
    'student@brainz.edu',
    'Ishaan Kalra',
    'student',
    'XI-B',
    'Commerce',
    '11111111-1111-1111-1111-111111111102', -- Orion House
    'BOS-XIB-041',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'
);

-- Seed XI-B Student Cohort (Matches Attendance & Gradebook Rosters)
SELECT public.seed_user('a0000000-0000-0000-0000-000000000004', 'kabir.sharma@brainz.edu', 'Kabir Sharma', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111101', '1102-02', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000005', 'ananya.gupta@brainz.edu', 'Ananya Gupta', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111102', '1102-03', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000006', 'rohan.varma@brainz.edu', 'Rohan Varma', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111103', '1102-04', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000007', 'diya.sen@brainz.edu', 'Diya Sen', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111104', '1102-05', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000008', 'meera.nair@brainz.edu', 'Meera Nair', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111101', '1102-06', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000009', 'devansh.patel@brainz.edu', 'Devansh Patel', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111102', '1102-07', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000010', 'aarohi.joshi@brainz.edu', 'Aarohi Joshi', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111103', '1102-08', NULL);
SELECT public.seed_user('a0000000-0000-0000-0000-000000000011', 'tanvi.rao@brainz.edu', 'Tanvi Rao', 'student', 'XI-B', 'Commerce', '11111111-1111-1111-1111-111111111104', '1102-09', NULL);

-- Clean up temporary seed helper
DROP FUNCTION public.seed_user(UUID, TEXT, TEXT, public.user_role, TEXT, TEXT, UUID, TEXT, TEXT);

-- -----------------------------------------------------------------------------
-- 4. TIMETABLE ENTRIES (Class XI-B Daily Schedule)
-- -----------------------------------------------------------------------------

INSERT INTO public.timetable_entries (class_section, day_of_week, period_number, start_time, end_time, subject, teacher_id, room)
SELECT 'XI-B', d.day, 1, '08:30:00', '09:20:00', 'English Core', 'a0000000-0000-0000-0000-000000000021', 'Room 204'
FROM (VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'), ('Friday')) AS d(day);

INSERT INTO public.timetable_entries (class_section, day_of_week, period_number, start_time, end_time, subject, teacher_id, room)
SELECT 'XI-B', d.day, 2, '09:25:00', '10:15:00', 'Economics', 'a0000000-0000-0000-0000-000000000002', 'Room 208'
FROM (VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'), ('Friday')) AS d(day);

INSERT INTO public.timetable_entries (class_section, day_of_week, period_number, start_time, end_time, subject, teacher_id, room)
SELECT 'XI-B', d.day, 3, '10:20:00', '11:10:00', 'Accountancy', 'a0000000-0000-0000-0000-000000000022', 'Room 112'
FROM (VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'), ('Friday')) AS d(day);

INSERT INTO public.timetable_entries (class_section, day_of_week, period_number, start_time, end_time, subject, teacher_id, room)
SELECT 'XI-B', d.day, 4, '11:15:00', '12:05:00', 'Political Science', 'a0000000-0000-0000-0000-000000000023', 'Room 301'
FROM (VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'), ('Friday')) AS d(day);

INSERT INTO public.timetable_entries (class_section, day_of_week, period_number, start_time, end_time, subject, teacher_id, room)
SELECT 'XI-B', d.day, 5, '12:45:00', '13:35:00', 'Business Studies', 'a0000000-0000-0000-0000-000000000024', 'Room 210'
FROM (VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'), ('Friday')) AS d(day);

-- -----------------------------------------------------------------------------
-- 5. ATTENDANCE RECORDS (Matches Teacher Attendance Page in BrainzOS.html)
-- -----------------------------------------------------------------------------

INSERT INTO public.attendance_records (student_id, date, status, check_in_time, seat, marked_by) VALUES
    ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, 'present', '11:58:00', 'B-12', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000004', CURRENT_DATE, 'present', '11:58:00', 'A-08', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000005', CURRENT_DATE, 'present', '11:59:00', 'C-03', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000006', CURRENT_DATE, 'late',    '12:04:00', 'B-04', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000007', CURRENT_DATE, 'absent',  NULL,       'A-14', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000008', CURRENT_DATE, 'present', '11:57:00', 'C-11', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000009', CURRENT_DATE, 'present', '11:58:00', 'B-02', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000010', CURRENT_DATE, 'present', '11:59:00', 'A-01', 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000011', CURRENT_DATE, 'late',    '12:02:00', 'C-07', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (student_id, date) DO UPDATE SET
    status = EXCLUDED.status,
    check_in_time = EXCLUDED.check_in_time;

-- -----------------------------------------------------------------------------
-- 6. ASSIGNMENTS & SUBMISSIONS
-- -----------------------------------------------------------------------------

INSERT INTO public.assignments (id, title, subject, class_section, due_date, weightage, created_by) VALUES
    ('44444444-4444-4444-4444-444444444401', 'Market Structure Case', 'Political Science', 'XI-B', now() + INTERVAL '1 day', 20, 'a0000000-0000-0000-0000-000000000002'),
    ('44444444-4444-4444-4444-444444444402', 'Fiscal Policy & Union Budget Analysis', 'Economics', 'XI-A', now() + INTERVAL '4 days', 25, 'a0000000-0000-0000-0000-000000000002'),
    ('44444444-4444-4444-4444-444444444403', 'Constitution & Federalism Essay', 'Political Science', 'XI-B', now() + INTERVAL '7 days', 30, 'a0000000-0000-0000-0000-000000000002'),
    ('44444444-4444-4444-4444-444444444404', 'Monetary Policy & Inflation Simulation', 'Economics', 'XI-A', now() + INTERVAL '10 days', 25, 'a0000000-0000-0000-0000-000000000002'),
    ('44444444-4444-4444-4444-444444444405', 'Global Trade Barriers Debate Brief', 'Political Science', 'XI-B', now() + INTERVAL '14 days', 25, 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Seed Submissions
INSERT INTO public.assignment_submissions (assignment_id, student_id, completed, completed_at) VALUES
    ('44444444-4444-4444-4444-444444444401', 'a0000000-0000-0000-0000-000000000001', TRUE, now() - INTERVAL '2 hours'),
    ('44444444-4444-4444-4444-444444444401', 'a0000000-0000-0000-0000-000000000004', TRUE, now() - INTERVAL '3 hours'),
    ('44444444-4444-4444-4444-444444444401', 'a0000000-0000-0000-0000-000000000005', TRUE, now() - INTERVAL '5 hours'),
    ('44444444-4444-4444-4444-444444444401', 'a0000000-0000-0000-0000-000000000006', FALSE, NULL),
    ('44444444-4444-4444-4444-444444444403', 'a0000000-0000-0000-0000-000000000001', FALSE, NULL)
ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    completed = EXCLUDED.completed,
    completed_at = EXCLUDED.completed_at;

-- -----------------------------------------------------------------------------
-- 7. GRADES (Matches Gradebook in BrainzOS.html)
-- -----------------------------------------------------------------------------

INSERT INTO public.grades (student_id, assignment_id, category, score, max_score) VALUES
    -- Ishaan Kalra
    ('a0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444401', 'quiz', 18, 20),
    ('a0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444401', 'case_study', 36, 40),
    ('a0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444401', 'presentation', 37, 40),
    -- Kabir Sharma
    ('a0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444401', 'quiz', 16, 20),
    ('a0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444401', 'case_study', 32, 40),
    ('a0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444401', 'presentation', 34, 40),
    -- Ananya Gupta
    ('a0000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444401', 'quiz', 19, 20),
    ('a0000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444401', 'case_study', 38, 40),
    ('a0000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444401', 'presentation', 39, 40),
    -- Rohan Varma
    ('a0000000-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444401', 'quiz', 13, 20),
    ('a0000000-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444401', 'case_study', 27, 40),
    ('a0000000-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444401', 'presentation', 28, 40),
    -- Diya Sen
    ('a0000000-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444401', 'quiz', 17, 20),
    ('a0000000-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444401', 'case_study', 34, 40),
    ('a0000000-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444401', 'presentation', 35, 40),
    -- Meera Nair
    ('a0000000-0000-0000-0000-000000000008', '44444444-4444-4444-4444-444444444401', 'quiz', 15, 20),
    ('a0000000-0000-0000-0000-000000000008', '44444444-4444-4444-4444-444444444401', 'case_study', 30, 40),
    ('a0000000-0000-0000-0000-000000000008', '44444444-4444-4444-4444-444444444401', 'presentation', 32, 40),
    -- Devansh Patel
    ('a0000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444401', 'quiz', 12, 20),
    ('a0000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444401', 'case_study', 25, 40),
    ('a0000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444401', 'presentation', 26, 40),
    -- Aarohi Joshi
    ('a0000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444401', 'quiz', 18, 20),
    ('a0000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444401', 'case_study', 35, 40),
    ('a0000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444401', 'presentation', 36, 40);

-- -----------------------------------------------------------------------------
-- 8. PITCH PAD VENTURES (6 Core Startups from BrainzOS.html)
-- -----------------------------------------------------------------------------

INSERT INTO public.ventures (id, name, description, category, tags, founder_id, votes, directors_pick, status) VALUES
    (
        '55555555-5555-5555-5555-555555555501',
        'CampusCart',
        'Decentralized campus peer marketplace for textbooks, lab equipment, and student-made essentials.',
        'Commerce & Logistics',
        ARRAY['P2P Marketplace', 'Zero Commission', 'Campus Verified'],
        'a0000000-0000-0000-0000-000000000001', -- Ishaan Kalra
        58,
        TRUE,
        'approved'
    ),
    (
        '55555555-5555-5555-5555-555555555502',
        'SkillSync',
        'AI-curated peer tutoring network matching senior mentors with juniors based on subject mastery gaps.',
        'EdTech & Mentorship',
        ARRAY['Micro-Mentorship', 'Class XI/XII', 'Reputation Score'],
        'a0000000-0000-0000-0000-000000000005', -- Ananya Gupta
        47,
        FALSE,
        'pending'
    ),
    (
        '55555555-5555-5555-5555-555555555503',
        'QueueLess',
        'Smart cafeteria preorder & pickup slot allocation system eliminating lunch break congestion.',
        'Campus Utilities & IoT',
        ARRAY['NFC Pickup', 'Inventory Sync', 'Ishaan Kalra Co-Founder'],
        'a0000000-0000-0000-0000-000000000001', -- Ishaan Kalra
        42,
        TRUE,
        'approved'
    ),
    (
        '55555555-5555-5555-5555-555555555504',
        'StudySphere',
        'Collaborative Pomodoro focus rooms with synchronized ambient soundscapes and inter-school study leagues.',
        'Productivity & Social',
        ARRAY['Focus Analytics', 'Virtual Library', 'Gamified Badges'],
        'a0000000-0000-0000-0000-000000000004', -- Kabir Sharma
        36,
        FALSE,
        'pending'
    ),
    (
        '55555555-5555-5555-5555-555555555505',
        'EcoTrack',
        'IoT-enabled campus waste segregation and carbon audit tracker with house point rewards for green habits.',
        'CleanTech & Sustainability',
        ARRAY['Hardware IoT', 'Carbon Accounting', 'House Cup Bonus'],
        'a0000000-0000-0000-0000-000000000007', -- Diya Sen
        29,
        FALSE,
        'approved'
    ),
    (
        '55555555-5555-5555-5555-555555555506',
        'ClubFlow',
        'Unified event management, attendance logging, and budget tracker for high-school extracurricular societies.',
        'SaaS & Operations',
        ARRAY['Event Ticketing', 'Society Budgets', 'Approval Workflows'],
        'a0000000-0000-0000-0000-000000000006', -- Rohan Varma
        25,
        TRUE,
        'approved'
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    votes = EXCLUDED.votes,
    directors_pick = EXCLUDED.directors_pick,
    status = EXCLUDED.status;

-- -----------------------------------------------------------------------------
-- 9. VENTURE VOTES (Individual Student Ballots)
-- -----------------------------------------------------------------------------

INSERT INTO public.venture_votes (venture_id, student_id) VALUES
    ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000004'),
    ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000005'),
    ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000006'),
    ('55555555-5555-5555-5555-555555555502', 'a0000000-0000-0000-0000-000000000001'),
    ('55555555-5555-5555-5555-555555555503', 'a0000000-0000-0000-0000-000000000008'),
    ('55555555-5555-5555-5555-555555555504', 'a0000000-0000-0000-0000-000000000009'),
    ('55555555-5555-5555-5555-555555555505', 'a0000000-0000-0000-0000-000000000010'),
    ('55555555-5555-5555-5555-555555555506', 'a0000000-0000-0000-0000-000000000011')
ON CONFLICT (venture_id, student_id) DO NOTHING;

-- Align initial venture vote counts with seeded ballots or mock numbers
UPDATE public.ventures SET votes = 58 WHERE id = '55555555-5555-5555-5555-555555555501';
UPDATE public.ventures SET votes = 47 WHERE id = '55555555-5555-5555-5555-555555555502';
UPDATE public.ventures SET votes = 42 WHERE id = '55555555-5555-5555-5555-555555555503';
UPDATE public.ventures SET votes = 36 WHERE id = '55555555-5555-5555-5555-555555555504';
UPDATE public.ventures SET votes = 29 WHERE id = '55555555-5555-5555-5555-555555555505';
UPDATE public.ventures SET votes = 25 WHERE id = '55555555-5555-5555-5555-555555555506';

-- -----------------------------------------------------------------------------
-- 10. BROADCASTS (School-wide & Department Announcements)
-- -----------------------------------------------------------------------------

INSERT INTO public.broadcasts (id, headline, message, audience, published_by, created_at) VALUES
    (
        '66666666-6666-6666-6666-666666666601',
        'Mid-Term Political Science Syllabus Clarification',
        'Please note that Chapters 3 & 4 on Judicial Review and Federal Structure are weighted at 40% of the midterm continuous assessment. The case study presentation rubric has been uploaded.',
        'XI Commerce',
        'a0000000-0000-0000-0000-000000000002',
        now() - INTERVAL '2 hours'
    ),
    (
        '66666666-6666-6666-6666-666666666602',
        'Inter-School Economics & Commerce Conclave 2026',
        'Registrations for the CBSE National Policy Summit are now open. Interested students from XI and XII Commerce should submit draft policy briefs to Room B-204 by Friday.',
        'Whole School',
        'a0000000-0000-0000-0000-000000000002',
        now() - INTERVAL '1 day'
    ),
    (
        '66666666-6666-6666-6666-666666666603',
        'Staff Council: Term 1 Continuous Assessment Deadlines',
        'All faculty must reconcile biometric roll logs and continuous quiz records before Friday 5:00 PM for academic audit validation.',
        'Staff Only',
        'a0000000-0000-0000-0000-000000000002',
        now() - INTERVAL '2 days'
    )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. AUDIT LOGS (Matches Directorial Ledger in BrainzOS.html)
-- -----------------------------------------------------------------------------

INSERT INTO public.audit_logs (actor_id, action, device, created_at) VALUES
    ('a0000000-0000-0000-0000-000000000003', 'Viewed venture queue', 'Admin Console', now() - INTERVAL '18 minutes'),
    ('a0000000-0000-0000-0000-000000000002', 'Published broadcast', 'Teacher Portal', now() - INTERVAL '22 minutes'),
    (NULL, 'Digital pass token rotated', 'Auth Service', now() - INTERVAL '39 minutes'),
    (NULL, 'Routine perimeter telemetry sync', 'IoT Node #12', now() - INTERVAL '1 hour 5 minutes'),
    ('a0000000-0000-0000-0000-000000000002', 'Gradebook entry signed (Political Science XI-B)', 'Faculty Portal', now() - INTERVAL '1 hour 45 minutes'),
    (NULL, 'Daily database backup snapshot completed', 'Storage Cluster', now() - INTERVAL '2 hours 12 minutes');

-- -----------------------------------------------------------------------------
-- 12. EMERGENCY EVENTS
-- -----------------------------------------------------------------------------

INSERT INTO public.emergency_events (triggered_by, type, created_at) VALUES
    ('a0000000-0000-0000-0000-000000000003', 'silent_test', now() - INTERVAL '3 days');
