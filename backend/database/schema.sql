CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pgvector powers semantic search + RAG (see database/migrations/001_semantic_search.sql)
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(255) NOT NULL UNIQUE,
    hashed_password  TEXT         NOT NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT now()
);

-- What keeps someone signed in after the access token expires. Only a hash of
-- each token is stored; see backend/app/core/sessions.py and migration 007.
CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    family_id   UUID        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    relationship  VARCHAR(50)  NOT NULL,
    date_of_birth DATE,
    gender        VARCHAR(20),
    created_at    TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE records (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type       VARCHAR(50)  NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'processing',
    file_url            TEXT,
    file_path           TEXT,
    raw_ocr_text        TEXT,
    doctor_name         VARCHAR(200),
    hospital_name       VARCHAR(200),
    document_date       DATE,
    specialty           VARCHAR(100),
    diagnosis           TEXT,
    recommendations     TEXT,
    document_category   VARCHAR(30)  DEFAULT 'prescription',
    bill_amount         DECIMAL(10,2) NULL,
    insurance_claimed   BOOLEAN      DEFAULT false,
    visit_group         VARCHAR(100) NULL,
    bill_title          VARCHAR(200) NULL,
    bill_category       VARCHAR(100) NULL,
    bill_number         VARCHAR(100) NULL,
    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE medicines (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   UUID         NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    dosage      VARCHAR(100),
    frequency   VARCHAR(100),
    duration    VARCHAR(100)
);

CREATE TABLE record_edits (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   UUID         NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_name  VARCHAR(100) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    edited_at   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE record_files (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   UUID         NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    file_url    TEXT         NOT NULL,
    file_path   TEXT         NOT NULL,
    page_number INTEGER      DEFAULT 1,
    created_at  TIMESTAMP    DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_hash    ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family  ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX idx_profiles_user_id      ON profiles(user_id);
CREATE INDEX idx_records_profile_id    ON records(profile_id);
CREATE INDEX idx_records_status        ON records(status);
CREATE INDEX idx_records_doctor_name   ON records(doctor_name);
CREATE INDEX idx_records_document_date ON records(document_date);
CREATE INDEX idx_records_document_category ON records(document_category);
CREATE INDEX idx_records_visit_group   ON records(visit_group);
CREATE INDEX idx_medicines_record_id   ON medicines(record_id);
CREATE INDEX idx_record_files_record   ON record_files(record_id);
CREATE UNIQUE INDEX uq_record_files_file_path ON record_files(file_path);
CREATE INDEX idx_records_profile_status_updated ON records(profile_id, status, updated_at);
CREATE INDEX idx_records_profile_created ON records(profile_id, created_at DESC);
CREATE INDEX idx_records_profile_category_date ON records(profile_id, document_category, document_date DESC);
CREATE INDEX idx_record_edits_record ON record_edits(record_id, edited_at DESC);
-- ILIKE '%term%' over document text needs trigrams; a btree cannot help.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_records_ocr_text_trgm ON records USING gin (raw_ocr_text gin_trgm_ops);

-- Semantic search: 384-dim embedding (BAAI/bge-small-en-v1.5) + ANN index + RPC.
ALTER TABLE records ADD COLUMN IF NOT EXISTS embedding vector(384);
CREATE INDEX IF NOT EXISTS idx_records_embedding
    ON records USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_records(
    query_embedding vector(384),
    p_profile_ids uuid[],
    match_count int default 20,
    match_threshold float default 0.25
)
RETURNS TABLE (id uuid, similarity float)
LANGUAGE sql STABLE AS $$
    SELECT r.id, 1 - (r.embedding <=> query_embedding) AS similarity
    FROM records r
    WHERE r.profile_id = ANY (p_profile_ids)
      AND r.embedding IS NOT NULL
      AND 1 - (r.embedding <=> query_embedding) > match_threshold
    ORDER BY r.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- ── Access rules ────────────────────────────────────────────────────────────
-- The backend authenticates users itself and connects with the service_role
-- key, which bypasses RLS. Everyone else (the public anon key, any signed-in
-- Supabase user) is denied everything: RLS on with no policies, and the
-- default grants revoked. Same as migrations 002, 004 and 006, so a fresh
-- install is locked down from the start instead of after a later migration.
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users          FROM anon, authenticated;
REVOKE ALL ON public.refresh_tokens FROM anon, authenticated;
REVOKE ALL ON public.profiles     FROM anon, authenticated;
REVOKE ALL ON public.records      FROM anon, authenticated;
REVOKE ALL ON public.medicines    FROM anon, authenticated;
REVOKE ALL ON public.record_edits FROM anon, authenticated;
REVOKE ALL ON public.record_files FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_records(vector, uuid[], int, float) FROM PUBLIC, anon, authenticated;
