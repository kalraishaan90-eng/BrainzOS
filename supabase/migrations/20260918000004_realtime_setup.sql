-- =============================================================================
-- Migration: 20260918000004_realtime_setup.sql
-- Description: Supabase Realtime Publication Configuration for Live Events
-- Stack: Supabase PostgreSQL
-- =============================================================================

-- Ensure replica identity is FULL so clients receive old and new payloads on updates
ALTER TABLE public.broadcasts REPLICA IDENTITY FULL;
ALTER TABLE public.emergency_events REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.ventures REPLICA IDENTITY FULL;
ALTER TABLE public.venture_votes REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

-- Add real-time event publishing for key tables
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_events;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ventures;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.venture_votes;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
