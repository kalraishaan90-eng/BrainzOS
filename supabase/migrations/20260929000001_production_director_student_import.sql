-- =============================================================================
-- Migration: 20260929000001_production_director_student_import.sql
-- Description: Directorial Bulk Student CSV Import RPC & Password Rotation Support
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BULK STUDENT IMPORT RPC FUNCTION
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bulk_import_students(p_students JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_item          JSONB;
    v_name          TEXT;
    v_email         TEXT;
    v_class         TEXT;
    v_stream        TEXT;
    v_house_name    TEXT;
    v_house_id      UUID;
    v_user_id       UUID;
    v_count_added   INT := 0;
    v_count_skipped INT := 0;
    v_encrypted_pwd TEXT;
    v_code          TEXT;
BEGIN
    -- Only Director can execute bulk student onboarding
    IF NOT public.is_director() THEN
        RAISE EXCEPTION 'Permission Denied: Only a Director can bulk-import students.';
    END IF;

    -- Standard initial password: "Student@2026!"
    v_encrypted_pwd := crypt('Student@2026!', gen_salt('bf', 10));

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_students)
    LOOP
        v_name       := TRIM(v_item->>'name');
        v_email      := LOWER(TRIM(v_item->>'email'));
        v_class      := TRIM(v_item->>'class_section');
        v_stream     := TRIM(v_item->>'stream');
        v_house_name := TRIM(v_item->>'house');

        IF v_name IS NULL OR v_name = '' OR v_email IS NULL OR v_email = '' OR POSITION('@' IN v_email) = 0 THEN
            v_count_skipped := v_count_skipped + 1;
            CONTINUE;
        END IF;

        -- Resolve house ID
        SELECT id INTO v_house_id FROM public.houses WHERE LOWER(name) = LOWER(v_house_name) LIMIT 1;
        IF v_house_id IS NULL THEN
            -- Default to Nalanda if house unassigned
            SELECT id INTO v_house_id FROM public.houses WHERE LOWER(name) = 'nalanda' LIMIT 1;
        END IF;

        -- Check if student already exists in auth.users
        SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_email;

        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
            v_code := 'BOS-' || REPLACE(v_class, ' ', '') || '-' || LPAD((v_count_added + 1)::TEXT, 3, '0');

            -- Insert Auth Record
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
                updated_at
            ) VALUES (
                v_user_id,
                '00000000-0000-0000-0000-000000000000',
                'authenticated',
                'authenticated',
                v_email,
                v_encrypted_pwd,
                NOW(),
                '{"provider": "email", "providers": ["email"]}'::JSONB,
                jsonb_build_object(
                    'full_name', v_name,
                    'role', 'student',
                    'class_section', v_class,
                    'stream', v_stream,
                    'must_change_password', true
                ),
                NOW(),
                NOW()
            );

            -- Insert Profile Record
            INSERT INTO public.profiles (
                id,
                full_name,
                role,
                class_section,
                stream,
                house_id,
                student_id_code,
                status
            ) VALUES (
                v_user_id,
                v_name,
                'student',
                v_class,
                v_stream,
                v_house_id,
                v_code,
                'active'
            )
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                class_section = EXCLUDED.class_section,
                stream = EXCLUDED.stream,
                house_id = EXCLUDED.house_id;

            v_count_added := v_count_added + 1;
        ELSE
            -- Existing user: update profile metadata
            UPDATE public.profiles SET
                full_name = v_name,
                class_section = v_class,
                stream = v_stream,
                house_id = COALESCE(v_house_id, house_id)
            WHERE id = v_user_id;

            v_count_skipped := v_count_skipped + 1;
        END IF;
    END LOOP;

    -- Record audit log
    INSERT INTO public.audit_logs (actor_id, action, device)
    VALUES (
        auth.uid(),
        FORMAT('Directorial CSV Import: %s student(s) imported, %s skipped/updated.', v_count_added, v_count_skipped),
        'Director Executive Console'
    );

    RETURN jsonb_build_object(
        'imported', v_count_added,
        'skipped', v_count_skipped,
        'total', v_count_added + v_count_skipped
    );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_import_students(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_import_students(JSONB) TO authenticated;
