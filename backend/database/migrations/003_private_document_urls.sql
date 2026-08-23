-- 003_private_document_urls.sql
-- Purge stored public document URLs and stop requiring them.
--
-- BACKGROUND
-- Uploads used to store `get_public_url(file_path)` in records.file_url and
-- record_files.file_url. If the `medical-records` bucket is (or ever becomes)
-- public, each of those rows is a permanent, unauthenticated link to somebody's
-- medical document — and the URLs also leaked into API responses that were not
-- re-signed. The application no longer writes or reads these columns: every
-- document URL is now a short-lived signed URL minted per request from
-- file_path. This migration removes the stale values.
--
-- SAFE TO RUN: file_path is untouched, so no document becomes unreachable.
-- Idempotent, and safe to re-run.

-- Drop the NOT NULL so new inserts can leave the column empty.
ALTER TABLE public.record_files ALTER COLUMN file_url DROP NOT NULL;

-- Clear the stored public URLs. file_path is the source of truth.
UPDATE public.records      SET file_url = NULL WHERE file_url IS NOT NULL;
UPDATE public.record_files SET file_url = NULL WHERE file_url IS NOT NULL OR file_url = '';

COMMENT ON COLUMN public.records.file_url IS
    'Deprecated. Document URLs are signed per request from file_path; never stored.';
COMMENT ON COLUMN public.record_files.file_url IS
    'Deprecated. Document URLs are signed per request from file_path; never stored.';

-- REMINDER (dashboard step, cannot be done in SQL):
-- Storage -> medical-records -> make sure the bucket is set to PRIVATE.
-- With a public bucket, anyone who ever saw a document URL keeps access.
