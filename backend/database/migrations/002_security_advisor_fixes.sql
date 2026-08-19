-- 002_security_advisor_fixes.sql
-- Fixes for the Supabase Database Advisor findings (2026-08-19):
--   6 ERRORS  : "RLS Disabled in Public" on all 6 application tables
--   2 WARNINGS: "Function Search Path Mutable" on match_records + update_updated_at_column
--   1 WARNING : "Extension in Public" on the vector extension (addressed in comments only)
--
-- ARCHITECTURE NOTE — READ BEFORE RUNNING:
-- MediVault does NOT use Supabase Auth. Authentication is custom JWT (jose/bcrypt)
-- and authorization is enforced in the FastAPI layer. That means auth.uid() is
-- always NULL here, so classic per-row RLS policies keyed on auth.uid() would NOT
-- work. Instead we:
--   1. Move the backend to the SERVICE_ROLE key (which BYPASSES RLS), then
--   2. Enable RLS with NO policies (default deny-all) on every table.
-- Result: the backend keeps working unchanged, while the public/anon PostgREST
-- API can no longer read or write these tables. The hole is closed.
--
-- >>> ORDER OF OPERATIONS (do NOT skip): <<<
--   Step 1: On Railway, set SUPABASE_KEY to the project's SERVICE_ROLE key
--           (Supabase Dashboard -> Project Settings -> API -> service_role).
--           Redeploy and confirm the app still works (RLS is still off at this point).
--   Step 2: THEN run this script in the Supabase SQL editor.
-- If you enable RLS while the backend is still on the anon key, every query
-- returns empty and the app breaks. Switch the key first.

-- ============================================================================
-- PART 1 — Enable Row Level Security (deny-all) on all application tables
-- ============================================================================
-- No policies are created on purpose: with RLS enabled and no policy, every
-- non-privileged role (anon, authenticated) is denied. service_role bypasses
-- RLS, so the FastAPI backend is unaffected.

ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_files ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: also revoke the blanket grants PostgREST hands to the
-- anon/authenticated roles so the tables aren't even reachable via the REST API.
REVOKE ALL ON public.users        FROM anon, authenticated;
REVOKE ALL ON public.profiles     FROM anon, authenticated;
REVOKE ALL ON public.records      FROM anon, authenticated;
REVOKE ALL ON public.medicines    FROM anon, authenticated;
REVOKE ALL ON public.record_edits FROM anon, authenticated;
REVOKE ALL ON public.record_files FROM anon, authenticated;

-- ============================================================================
-- PART 2 — Pin a fixed search_path on the flagged functions (fixes 2 warnings)
-- ============================================================================
-- A mutable search_path lets a caller shadow objects the function references.
-- We pin it to `public` (NOT an empty string): match_records references the
-- unqualified `records` table and the pgvector `<=>` operator, both of which
-- live in the public schema, so an empty search_path would break the function.
-- Pinning to a fixed value is what clears the advisor warning.
-- This DO block handles any function signature/overload automatically, so you
-- don't need to know the exact argument types.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname IN ('match_records', 'update_updated_at_column')
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public;', r.sig);
  END LOOP;
END $$;

-- ============================================================================
-- PART 3 — "Extension in Public" (vector)  [OPTIONAL / LOW PRIORITY — NOT RUN]
-- ============================================================================
-- The advisor flags pgvector living in the public schema. Relocating it to a
-- dedicated `extensions` schema is the textbook fix, BUT it is disruptive: the
-- match_records function and the embedding vector(384) column both depend on
-- the vector type, and moving the extension can break type resolution and the
-- RPC. This is only a WARNING, not a security hole. Recommendation: leave it as
-- is unless you are doing a clean rebuild. If you ever rebuild from scratch:
--   CREATE SCHEMA IF NOT EXISTS extensions;
--   CREATE EXTENSION vector SCHEMA extensions;  -- (on a fresh DB, before use)
