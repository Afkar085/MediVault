-- Migration 001: semantic search + RAG support (pgvector)
-- Run this once against an existing MediVault database (e.g. in the Supabase
-- SQL editor). Safe to re-run: every statement is idempotent.

-- 1. Enable the pgvector extension.
create extension if not exists vector;

-- 2. Add a 384-dim embedding column to records (matches BAAI/bge-small-en-v1.5).
alter table records add column if not exists embedding vector(384);

-- 3. Approximate-nearest-neighbour index for fast cosine similarity.
create index if not exists idx_records_embedding
    on records using hnsw (embedding vector_cosine_ops);

-- 4. RPC used by the app for vector search, scoped to the caller's profiles.
--    Returns record ids above a similarity threshold, most-similar first.
create or replace function match_records(
    query_embedding vector(384),
    p_profile_ids uuid[],
    match_count int default 20,
    match_threshold float default 0.25
)
returns table (id uuid, similarity float)
language sql
stable
as $$
    select r.id,
           1 - (r.embedding <=> query_embedding) as similarity
    from records r
    where r.profile_id = any (p_profile_ids)
      and r.embedding is not null
      and 1 - (r.embedding <=> query_embedding) > match_threshold
    order by r.embedding <=> query_embedding
    limit match_count;
$$;

-- Note: existing records have a NULL embedding until they are re-processed or
-- backfilled. New uploads are embedded automatically.
