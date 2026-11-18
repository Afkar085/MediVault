-- 011_rollback.sql
-- Undo 011_health_profile.sql. Deletes the allergies, conditions, long-term
-- medicines and blood groups saved for family members.

ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS allergies,
    DROP COLUMN IF EXISTS conditions,
    DROP COLUMN IF EXISTS long_term_medicines,
    DROP COLUMN IF EXISTS blood_group;
