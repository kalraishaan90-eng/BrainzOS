-- =============================================================================
-- Migration: 20260927000001_storage_buckets_and_attachments.sql
-- Description:
--   1. Project-Scoped Storage Buckets:
--      - 'avatars': Dedicated bucket for user profile pictures (max 5MB).
--      - 'assignment-attachments': Dedicated private bucket for student assignment
--        submissions and teacher coursework documents (max 25MB).
--   2. Strict Row Level Security Policies on storage.objects:
--      - Students can only upload/modify objects within their own auth.uid() folder path.
--      - Teachers can read student submissions for classes they are assigned to teach.
--      - Directors have full institutional oversight.
--   3. Database Schema Extensions:
--      - Add attachment_path column to public.assignments and public.assignment_submissions.
-- Stack: Supabase PostgreSQL & Supabase Storage
-- =============================================================================

-- =============================================================================
-- 1. EXTEND TABLES FOR ATTACHMENT PATH METADATA
-- =============================================================================

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS attachment_path TEXT;

ALTER TABLE public.assignment_submissions
ADD COLUMN IF NOT EXISTS attachment_path TEXT;

-- =============================================================================
-- 2. CREATE PROJECT-SCOPED STORAGE BUCKETS
-- =============================================================================

-- 2.1 Bucket: avatars (Publicly readable within institutional domain; write restricted)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    TRUE,
    5242880, -- 5 MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

-- 2.2 Bucket: assignment-attachments (Private bucket; accessed via RLS / signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assignment-attachments',
    'assignment-attachments',
    FALSE,
    26214400, -- 25 MB limit
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/zip'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 26214400;

-- =============================================================================
-- 3. STORAGE RLS POLICIES FOR 'avatars' BUCKET
-- =============================================================================

-- 3.1 SELECT: Any authenticated user can view avatar images
DROP POLICY IF EXISTS "avatars_storage_select" ON storage.objects;
CREATE POLICY "avatars_storage_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'avatars');

-- 3.2 INSERT: Users can upload avatar only to their own folder path (`<auth.uid()>/...`),
-- or a Director can upload for any user.
DROP POLICY IF EXISTS "avatars_storage_insert" ON storage.objects;
CREATE POLICY "avatars_storage_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (
            public.is_director()
            OR (storage.foldername(name))[1] = auth.uid()::text
        )
    );

-- 3.3 UPDATE: Users can update only their own avatar, or Director can manage all.
DROP POLICY IF EXISTS "avatars_storage_update" ON storage.objects;
CREATE POLICY "avatars_storage_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (
            public.is_director()
            OR (storage.foldername(name))[1] = auth.uid()::text
        )
    )
    WITH CHECK (
        bucket_id = 'avatars'
        AND (
            public.is_director()
            OR (storage.foldername(name))[1] = auth.uid()::text
        )
    );

-- 3.4 DELETE: Users can delete only their own avatar, or Director can manage all.
DROP POLICY IF EXISTS "avatars_storage_delete" ON storage.objects;
CREATE POLICY "avatars_storage_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (
            public.is_director()
            OR (storage.foldername(name))[1] = auth.uid()::text
        )
    );

-- =============================================================================
-- 4. STORAGE RLS POLICIES FOR 'assignment-attachments' BUCKET
-- =============================================================================
-- Path Convention:
--   Student Submission File: `<student_id>/<assignment_id>/<filename>`
--   Teacher Coursework File: `coursework/<assignment_id>/<filename>`

-- 4.1 SELECT:
--   - Directors can read all assignment attachments.
--   - Students can read their own submission files (`<auth.uid()>/*`) and general coursework materials (`coursework/*`).
--   - Teachers can read coursework files and submissions from students in their assigned class sections.
DROP POLICY IF EXISTS "assignment_attachments_storage_select" ON storage.objects;
CREATE POLICY "assignment_attachments_storage_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'assignment-attachments'
        AND (
            -- 1. Full Director access
            public.is_director()
            -- 2. Student reading their own submission
            OR (storage.foldername(name))[1] = auth.uid()::text
            -- 3. Shared coursework materials uploaded by teachers
            OR (storage.foldername(name))[1] = 'coursework'
            -- 4. Teacher reading submissions from scholars in their classes
            OR (
                public.is_teacher()
                AND EXISTS (
                    SELECT 1 FROM public.profiles student_prof
                    WHERE student_prof.id::text = (storage.foldername(storage.objects.name))[1]
                      AND public.is_teacher_of(student_prof.class_section)
                )
            )
        )
    );

-- 4.2 INSERT:
--   - Directors can insert anywhere in the bucket.
--   - Students can only upload into their own folder path (`<auth.uid()>/...`).
--   - Teachers can upload into the `coursework/` path.
DROP POLICY IF EXISTS "assignment_attachments_storage_insert" ON storage.objects;
CREATE POLICY "assignment_attachments_storage_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'assignment-attachments'
        AND (
            public.is_director()
            OR (
                -- Student upload condition
                NOT public.is_teacher()
                AND NOT public.is_director()
                AND (storage.foldername(name))[1] = auth.uid()::text
            )
            OR (
                -- Teacher coursework upload condition
                public.is_teacher()
                AND (storage.foldername(name))[1] = 'coursework'
            )
        )
    );

-- 4.3 UPDATE:
DROP POLICY IF EXISTS "assignment_attachments_storage_update" ON storage.objects;
CREATE POLICY "assignment_attachments_storage_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'assignment-attachments'
        AND (
            public.is_director()
            OR (storage.foldername(name))[1] = auth.uid()::text
            OR (public.is_teacher() AND (storage.foldername(name))[1] = 'coursework')
        )
    )
    WITH CHECK (
        bucket_id = 'assignment-attachments'
        AND (
            public.is_director()
            OR (storage.foldername(name))[1] = auth.uid()::text
            OR (public.is_teacher() AND (storage.foldername(name))[1] = 'coursework')
        )
    );

-- 4.4 DELETE:
DROP POLICY IF EXISTS "assignment_attachments_storage_delete" ON storage.objects;
CREATE POLICY "assignment_attachments_storage_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'assignment-attachments'
        AND (
            public.is_director()
            OR (storage.foldername(name))[1] = auth.uid()::text
            OR (public.is_teacher() AND (storage.foldername(name))[1] = 'coursework')
        )
    );

-- =============================================================================
-- 5. MIGRATE EXISTING EXTERNAL AVATAR URLS
-- =============================================================================
-- Any third-party external placeholder URLs (e.g. Unsplash) in public.profiles
-- are sanitized to NULL so users fallback cleanly to local monograms until
-- uploaded into the project-scoped 'avatars' Supabase Storage bucket.
UPDATE public.profiles
SET avatar_url = NULL
WHERE avatar_url LIKE 'https://images.unsplash.com/%';

