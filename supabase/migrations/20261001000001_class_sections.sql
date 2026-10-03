-- =============================================================================
-- Migration: 20261001000001_class_sections.sql
-- Description: Dynamic Class Sections Registry, RLS, Teacher Association & Audit Logging
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE: class_sections
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade INTEGER NOT NULL CHECK (grade >= 1 AND grade <= 12),
    section TEXT NOT NULL CHECK (char_length(section) > 0),
    stream TEXT CHECK (stream IS NULL OR stream IN ('Commerce', 'Science', 'Humanities')),
    display_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_stream_by_grade CHECK (
        (grade < 11 AND stream IS NULL) OR
        (grade >= 11 AND stream IS NOT NULL)
    )
);

-- Performance & relational lookup indexes
CREATE INDEX IF NOT EXISTS idx_class_sections_grade ON public.class_sections(grade);
CREATE INDEX IF NOT EXISTS idx_class_sections_active ON public.class_sections(active);

-- Uniqueness:
-- Grades 1-10: unique (grade, section) where stream is NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_sections_uniq_no_stream
    ON public.class_sections (grade, section)
    WHERE stream IS NULL;

-- Grades 11-12: unique (grade, section, stream) where stream is NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_sections_uniq_with_stream
    ON public.class_sections (grade, section, stream)
    WHERE stream IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. TRIGGER: Maintain updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_class_sections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_sections_updated_at ON public.class_sections;
CREATE TRIGGER trg_class_sections_updated_at
BEFORE UPDATE ON public.class_sections
FOR EACH ROW EXECUTE FUNCTION public.handle_class_sections_updated_at();

-- -----------------------------------------------------------------------------
-- 3. AUDIT LOGGING TRIGGER: Every insert/edit/delete writes to public.audit_logs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_class_sections_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_action TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'Created class section: ' || NEW.display_name;
        INSERT INTO public.audit_logs (actor_id, action, device, created_at)
        VALUES (v_actor_id, v_action, 'Director Operations Console', timezone('utc'::text, now()));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.active IS DISTINCT FROM NEW.active THEN
            IF NEW.active THEN
                v_action := 'Activated class section: ' || NEW.display_name;
            ELSE
                v_action := 'Deactivated class section: ' || NEW.display_name;
            END IF;
        ELSE
            v_action := 'Updated class section: ' || NEW.display_name;
        END IF;
        INSERT INTO public.audit_logs (actor_id, action, device, created_at)
        VALUES (v_actor_id, v_action, 'Director Operations Console', timezone('utc'::text, now()));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'Deleted class section: ' || OLD.display_name;
        INSERT INTO public.audit_logs (actor_id, action, device, created_at)
        VALUES (v_actor_id, v_action, 'Director Operations Console', timezone('utc'::text, now()));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_sections_audit ON public.class_sections;
CREATE TRIGGER trg_class_sections_audit
AFTER INSERT OR UPDATE OR DELETE ON public.class_sections
FOR EACH ROW EXECUTE FUNCTION public.handle_class_sections_audit();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) FOR class_sections
-- -----------------------------------------------------------------------------
ALTER TABLE public.class_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_sections_select_authenticated" ON public.class_sections;
CREATE POLICY "class_sections_select_authenticated"
    ON public.class_sections FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "class_sections_insert_director" ON public.class_sections;
CREATE POLICY "class_sections_insert_director"
    ON public.class_sections FOR INSERT
    TO authenticated
    WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "class_sections_update_director" ON public.class_sections;
CREATE POLICY "class_sections_update_director"
    ON public.class_sections FOR UPDATE
    TO authenticated
    USING (public.is_director())
    WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "class_sections_delete_director" ON public.class_sections;
CREATE POLICY "class_sections_delete_director"
    ON public.class_sections FOR DELETE
    TO authenticated
    USING (public.is_director());

REVOKE ALL ON public.class_sections FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sections TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. ENHANCE is_teacher_of TO SUPPORT MULTIPLE COMMA-SEPARATED CLASS SECTIONS
-- -----------------------------------------------------------------------------
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
              OR target_class_section = ANY(string_to_array(replace(p.class_section, ' ', ''), ','))
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
-- 6. SEED DATA (Grades 1-12, Sections A-D, Streams for Grades 11-12)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    g INT;
    s TEXT;
    str TEXT;
    sections TEXT[] := ARRAY['A', 'B', 'C', 'D'];
    streams TEXT[] := ARRAY['Commerce', 'Science', 'Humanities'];
    v_roman TEXT;
    v_display TEXT;
BEGIN
    -- Seed Grades 1 to 10: Sections A-D with NULL stream
    FOR g IN 1..10 LOOP
        FOREACH s IN ARRAY sections LOOP
            v_display := 'Class ' || g::TEXT || '-' || s;
            INSERT INTO public.class_sections (grade, section, stream, display_name, active)
            VALUES (g, s, NULL, v_display, true)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;

    -- Seed Grades 11 and 12: Sections A-D with Commerce, Science, Humanities
    FOR g IN 11..12 LOOP
        v_roman := CASE WHEN g = 11 THEN 'XI' ELSE 'XII' END;
        FOREACH s IN ARRAY sections LOOP
            FOREACH str IN ARRAY streams LOOP
                v_display := 'Class ' || v_roman || '-' || s || ' (' || str || ')';
                INSERT INTO public.class_sections (grade, section, stream, display_name, active)
                VALUES (g, s, str, v_display, true)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 7. REALTIME SETUP
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_sections;
    END IF;
EXCEPTION
    WHEN others THEN null;
END $$;
