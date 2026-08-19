CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pgvector powers semantic search + RAG (see database/migrations/001_semantic_search.sql)
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(255) NOT NULL UNIQUE,
    hashed_password  TEXT         NOT NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT now()
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

CREATE INDEX idx_profiles_user_id      ON profiles(user_id);
CREATE INDEX idx_records_profile_id    ON records(profile_id);
CREATE INDEX idx_records_status        ON records(status);
CREATE INDEX idx_records_doctor_name   ON records(doctor_name);
CREATE INDEX idx_records_document_date ON records(document_date);
CREATE INDEX idx_records_document_category ON records(document_category);
CREATE INDEX idx_records_visit_group   ON records(visit_group);
CREATE INDEX idx_medicines_record_id   ON medicines(record_id);
CREATE INDEX idx_record_files_record   ON record_files(record_id);

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
