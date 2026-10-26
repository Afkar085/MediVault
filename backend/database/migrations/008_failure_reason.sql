-- 008_failure_reason.sql
--
-- Why a document could not be read. Safe to run more than once; changes no
-- existing data.
--
-- "failed" on its own meant one thing to the app and another to the person
-- reading the screen: whatever had gone wrong, they were told the document
-- could not be read and advised to take a clearer photo. When Groq retired
-- the vision model on 2026-09-14 every upload failed that way, so perfectly
-- clear prescriptions were reported as unreadable and the only advice the app
-- could offer was one that could never work.
--
-- Two values, and the distinction is the whole point:
--   'unreadable'          - the document was read and had no text on it
--   'service_unavailable' - the reading service could not be reached at all
--
-- NULL means either an older record from before this column existed, or a
-- record that is not failed. Nothing reads it except to choose what to say.

ALTER TABLE public.records
    ADD COLUMN IF NOT EXISTS failure_reason TEXT;

COMMENT ON COLUMN public.records.failure_reason IS
    'Why status is failed: unreadable (no text on the document) or '
    'service_unavailable (the reading service could not be reached). '
    'NULL for records that are not failed.';
