-- 007_refresh_tokens_and_indexes.sql
--
-- Two unrelated-looking things that are both about the app feeling dependable:
-- sessions that survive a refresh, and the indexes the hot queries were missing.
-- Safe to run more than once; changes no existing data.

-- ── sessions that outlive the access token ──────────────────────────────────
--
-- The access token is deliberately short-lived now (an hour by default), so a
-- stolen one stops working quickly. What keeps you signed in is a refresh
-- token, and the only copy of it the server keeps is a SHA-256 hash, so a leak
-- of this table does not hand anyone a session. Each refresh rotates the token
-- and marks the old one used; a used token presented a second time means the
-- token was replayed, and the whole family of tokens is revoked.

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    -- Every token descended from one sign-in shares a family id, so detecting a
    -- replay can end that session without touching the user's other devices.
    family_id   UUID        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON public.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family  ON public.refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON public.refresh_tokens(expires_at);

-- Same deny-all posture as every other table (see 002): the backend uses the
-- service_role key and bypasses RLS; nothing else may read session tokens.
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'refresh_tokens'
          AND policyname = 'refresh_tokens_deny_all'
    ) THEN
        CREATE POLICY refresh_tokens_deny_all ON public.refresh_tokens
            FOR ALL TO public USING (false) WITH CHECK (false);
    END IF;
END $$;

REVOKE ALL ON public.refresh_tokens FROM anon, authenticated;

-- ── indexes the hot paths were missing ──────────────────────────────────────

-- The records list orders by created_at within one profile. Without the second
-- column Postgres had to sort every one of the member's rows on every load.
CREATE INDEX IF NOT EXISTS idx_records_profile_created
    ON public.records(profile_id, created_at DESC);

-- The bills screen orders by document_date within one profile.
CREATE INDEX IF NOT EXISTS idx_records_profile_category_date
    ON public.records(profile_id, document_category, document_date DESC);

-- A record's edit history is read by record_id and ordered newest first.
CREATE INDEX IF NOT EXISTS idx_record_edits_record
    ON public.record_edits(record_id, edited_at DESC);

-- Free-text search runs `raw_ocr_text ILIKE '%term%'`, which no btree index can
-- help with: it was a sequential scan over the full text of every document.
-- A trigram GIN index makes that an index scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_records_ocr_text_trgm
    ON public.records USING gin (raw_ocr_text gin_trgm_ops);
