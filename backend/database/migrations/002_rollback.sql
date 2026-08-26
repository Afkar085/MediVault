-- 002_rollback.sql
-- Undo 002_security_advisor_fixes.sql.
--
-- WHEN YOU WOULD RUN THIS
-- You applied 002 while the backend was still using the ANON key. Every query
-- now returns empty and the app looks like it has lost all its data. Nothing is
-- lost; the rows are there, the anon role simply cannot see them any more.
--
-- The better fix is to switch SUPABASE_KEY to the service_role key and redeploy,
-- because that closes the hole *and* keeps the app working. Use this only if you
-- need the app back immediately and cannot change the key right now.
--
-- Running this REOPENS the public REST API on your medical tables.

ALTER TABLE public.users        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.records      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_edits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_files DISABLE ROW LEVEL SECURITY;

-- Restore the grants Supabase gives these roles by default.
GRANT ALL ON public.users        TO anon, authenticated;
GRANT ALL ON public.profiles     TO anon, authenticated;
GRANT ALL ON public.records      TO anon, authenticated;
GRANT ALL ON public.medicines    TO anon, authenticated;
GRANT ALL ON public.record_edits TO anon, authenticated;
GRANT ALL ON public.record_files TO anon, authenticated;

-- The pinned search_path from 002 part 2 is left in place on purpose: it is a
-- hardening measure with no effect on whether the app can read its own data,
-- so there is no reason to undo it.
