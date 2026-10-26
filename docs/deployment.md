# Deploying MediVault

Steps that cannot be done from code, because they need the Supabase and hosting
dashboards. Run them in the order given — some of them break the app if applied
out of sequence.

## One-time hardening

1. **Use the service_role key.** Set `SUPABASE_KEY` on the backend host to the project's
   service_role key (Project Settings → API), then redeploy and confirm the app still works.
2. **Then** run `backend/database/migrations/002_security_advisor_fixes.sql` in the Supabase
   SQL editor. It enables deny-all RLS on all six tables, closing the public REST API.
   Running it *before* step 1 will break the app, so the order matters.
3. Run `backend/database/migrations/003_private_document_urls.sql` to clear the public
   document URLs stored by older uploads. `file_path` is untouched, so nothing becomes
   unreachable.
4. **Set the `medical-records` bucket to private** (Storage → bucket settings). The app only
   hands out signed URLs, but a public bucket means anyone who ever saw a URL keeps access.
5. Set `ALLOWED_ORIGINS` on the backend host to the deployed frontend URL, so CORS is
   actually restricted.
6. Optional, semantic search: run `001_semantic_search.sql` and `004_document_passages.sql`,
   and install `requirements-rag.txt`. These need more RAM than a 512MB tier provides.
   Without them, search and Ask fall back to term-overlap ranking and passages are computed
   from the stored document text on the fly, so everything still works, matching is just
   literal rather than semantic. Applying them later is safe: records without stored
   passages continue to be searched.

## The record-integrity and case-file release

None of this has been run against the real Supabase project or Groq yet: every
check so far used the local dev stack. Deploy in this order:

1. **Back up first.** Supabase → Database → Backups: confirm a recent backup exists (or
   take one) before any migration. Note the time.
2. **Check the migration on a throwaway Postgres** (optional, needs Docker):
   `bash backend/scripts/verify_migrations.sh`. It loads the previous schema, applies
   001–005, then 005 again to prove it is idempotent.
3. **Run `backend/database/migrations/005_bill_details_and_upload_dedup.sql`** in the
   Supabase SQL editor. Additive only: three nullable bill columns and indexes. It creates
   a unique index on `record_files.file_path` only if no file is already shared between
   records; if it prints a NOTICE instead, nothing was changed and the app still works
   (concurrent identical uploads then rely on the application check alone).
4. **Redeploy the backend** with `pip install -r requirements.txt`. **Pillow** is now a
   runtime dependency (turns sideways phone photos upright before OCR; the stored original
   is never modified). Without it, images are sent as they are.
5. **Redeploy the frontend.**
6. **Smoke test with a non-medical test document**, on a test family member, not real
   records:
   - Upload a photo of any printed page; it shows "Reading…", then appears once in the file.
   - Upload the same photo again; you are told it is already saved and no second row appears.
   - Upload a blank or dark photo; it appears under *Needs you*; *Try again* re-reads it;
     deleting it removes the warning, also after a refresh.
   - Edit a field, refresh: the change and its *edited* mark persist; it is in *Changes*.
   - Open a bill, set a title, refresh: the title persists (needs step 3).
   - Search for a word on the page; Ask a question about it and check the cited source.
   - Delete the test member: Supabase Storage no longer holds their files.
7. **Rollback:** the frontend and backend can be reverted to the previous deployment at
   any time. Migration 005 is additive and safe to leave in place after a rollback.

**Not implemented:** password reset by email. It needs an email provider, which is a paid
infrastructure decision. The sign-in screen says so plainly rather than pretending to send
a link.
