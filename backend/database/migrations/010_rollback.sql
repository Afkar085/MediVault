-- 010_rollback.sql
-- Undo 010_checked_at.sql. The app goes back to not tracking whether a record
-- was checked; nothing else changes.

ALTER TABLE public.records DROP COLUMN IF EXISTS checked_at;
