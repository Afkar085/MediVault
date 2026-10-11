-- 005_bill_details_and_upload_dedup.sql
--
-- 1. BILL DETAILS
-- The record editor has always offered Bill Title, Bill Category and Bill No.,
-- but no migration created those columns. The API swallowed the failed write and
-- showed "Updated", and the list never selected them, so a bill title vanished
-- on the next refresh. These columns make them persist.
--
-- The app works with or without this migration: it checks once whether the
-- columns exist, and until they do it tells the user those three fields could
-- not be saved instead of pretending.
--
-- 2. UPLOAD DE-DUPLICATION
-- Uploaded files are now stored under a key derived from their content, and an
-- upload whose files are already attached to a record returns that record
-- instead of creating a second one. That lookup is by record_files.file_path,
-- which had no index.
--
-- SAFE TO RUN: additive only, no existing row is changed or removed. Idempotent.
-- Take a backup (Database -> Backups) before running any migration anyway.

ALTER TABLE public.records ADD COLUMN IF NOT EXISTS bill_title    VARCHAR(200);
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS bill_category VARCHAR(100);
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS bill_number   VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_record_files_file_path ON public.record_files(file_path);

-- 3. ONE RECORD PER STORED FILE
-- Two identical uploads sent at the same moment (a double tap, two tabs) both
-- pass the "already saved?" check before either has written. This makes the
-- second insert fail, and the API then returns the first record instead of
-- creating a duplicate. It is only created when no file is shared today: older
-- uploads used random file names, so none should be, but if any are, nothing is
-- changed and a NOTICE says so (find them with the SELECT in the notice).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.record_files GROUP BY file_path HAVING count(*) > 1) THEN
    RAISE NOTICE 'Unique index skipped: some files are attached to more than one record. '
                 'List them with: SELECT file_path, count(*) FROM record_files GROUP BY 1 HAVING count(*) > 1;';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_record_files_file_path ON public.record_files(file_path);
  END IF;
END $$;

-- The stuck-job sweep and the status poll filter on (profile_id, status, updated_at).
CREATE INDEX IF NOT EXISTS idx_records_profile_status_updated
    ON public.records(profile_id, status, updated_at);
