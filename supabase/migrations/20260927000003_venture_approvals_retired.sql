-- =============================================================================
-- Migration: 20260927000003_venture_approvals_retired.sql
-- Description:
--   Non-destructive note accompanying the retirement of the Director Venture
--   Approvals page from the director experience (UI-only removal; no schema
--   change). This migration intentionally performs no DDL.
--
--   The `ventures` table and its `status` and `directors_pick` columns are kept
--   in the database as-is so the student-facing Pitch Pad page can continue
--   browsing ventures and casting peer votes normally.
--
--   OPEN ARCHITECTURE QUESTION (deliberately left undecided):
--   With the director approval page removed, new venture records will simply
--   remain in 'pending' status unless another admin path, faculty delegation,
--   or automated threshold workflow is added later. This note documents the
--   gap rather than silently deciding how venture approval should work going
--   forward.
-- =============================================================================

-- No schema changes. Kept as a marker so migration history reflects the
-- product decision that retired the director-side approval workflow.

SELECT 1;
