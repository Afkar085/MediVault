-- 004_document_passages.sql
-- Semantic search over the text of the documents, not just their extracted fields.
--
-- BACKGROUND
-- Migration 001 embeds one vector per record, built from its first 2000
-- characters. That answers "which visit was this?" but not "what was the
-- haemoglobin value?" — the number is further down the page, and the record
-- vector is too coarse to point at it either way.
--
-- This adds one row per passage (~600 characters), so retrieval can return the
-- specific piece of text a question is about, and the assistant can quote it.
--
-- OPTIONAL. Without this table the app chunks the stored OCR text on the fly and
-- ranks passages by term overlap, so document-grounded answers still work — just
-- without semantic matching ("sugar" will not find "glucose"). Applying it is
-- only worthwhile on a host that can also run the embedding model
-- (requirements-rag.txt); see the note at the end of 001.
--
-- Safe to re-run.

create extension if not exists vector;

create table if not exists document_passages (
    id          uuid primary key default gen_random_uuid(),
    record_id   uuid not null references records(id) on delete cascade,
    chunk_index int  not null,
    content     text not null,
    embedding   vector(384),
    created_at  timestamp not null default now(),
    unique (record_id, chunk_index)
);

create index if not exists idx_document_passages_record
    on document_passages(record_id);

create index if not exists idx_document_passages_embedding
    on document_passages using hnsw (embedding vector_cosine_ops);

-- Passages ranked by similarity, restricted to record ids the caller passes in.
-- The API layer only ever passes ids it has already authorized; this function
-- deliberately has no notion of users and grants nothing on its own.
create or replace function match_chunks(
    query_embedding vector(384),
    p_record_ids uuid[],
    match_count int default 12,
    match_threshold float default 0.20
)
returns table (record_id uuid, content text, similarity float)
language sql
stable
set search_path = public
as $$
    select p.record_id,
           p.content,
           1 - (p.embedding <=> query_embedding) as similarity
    from document_passages p
    where p.record_id = any (p_record_ids)
      and p.embedding is not null
      and 1 - (p.embedding <=> query_embedding) > match_threshold
    order by p.embedding <=> query_embedding
    limit match_count;
$$;

-- Same lockdown as every other table (see 002): the backend uses the
-- service_role key, which bypasses RLS; nothing else may read this.
alter table public.document_passages enable row level security;
revoke all on public.document_passages from anon, authenticated;

-- Existing records have no passages until they are re-processed. New uploads are
-- indexed automatically. To backfill, re-upload or run the OCR pipeline again.
