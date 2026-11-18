-- 010_checked_at.sql
--
-- When a person checked what was read off a document. Safe to run more than
-- once. Undo with 010_rollback.sql.
--
-- After a document is read, the app opens a review card: the doctor, date,
-- diagnosis and medicines it found, each one tap to fix. Save sets checked_at.
-- Leaving without Save keeps the record as it was read, with checked_at empty,
-- and the app lists it under "to check" on Home until someone saves it.
--
-- Records that already exist were saved before this card existed. They are
-- marked checked as of their last change, so the list starts empty instead of
-- asking about every old document at once.

ALTER TABLE public.records
    ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

UPDATE public.records
   SET checked_at = COALESCE(updated_at, created_at)
 WHERE checked_at IS NULL
   AND status = 'done'
   AND created_at < now();

COMMENT ON COLUMN public.records.checked_at IS
    'When a person saved the review card for this record. NULL: read but not checked yet.';
