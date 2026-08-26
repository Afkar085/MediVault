"""Retrieve the actual text of a document, not just its extracted fields.

Structured retrieval answers "which visit was this?"; it cannot answer "what was
the haemoglobin value?", because that number lives in the scanned text and was
never extracted into a column. This module returns the passages of that text
which are most relevant to a question, so the model can answer from the document
itself and cite it.

Two backends, in order:

1. Stored chunks with embeddings (migration 004 + pgvector): semantic, so
   "sugar" finds "glucose".
2. Chunking the stored OCR text on the fly and ranking passages by term overlap.

The second needs no migration, no extra service and no embedding model, so
document-grounded answers work on the smallest host. The first is strictly an
improvement on top.

Callers pass record ids they have *already* authorized; nothing here widens
scope on its own.
"""
import logging
from itertools import zip_longest
from typing import Dict, List, Optional

from app.database import supabase
from app.services.chunking import chunk_document
from app.services.embeddings import embed_text
from app.services.retrieval import score_text, tokenize

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 6
# Never put more of one document in front of the model than this, so a single
# long discharge summary cannot crowd out every other record.
MAX_PER_RECORD = 3


def _indexed_records(record_ids: List[str]) -> set:
    """Which of these records have passages stored.

    Needed because the two backends must cover different records rather than
    compete: after migration 004 is applied, everything uploaded before it has
    no stored passages, and those records must still be searched on the fly.
    """
    try:
        rows = (
            supabase.table("document_passages")
            .select("record_id")
            .in_("record_id", record_ids)
            .execute()
            .data
            or []
        )
        return {row["record_id"] for row in rows}
    except Exception:
        return set()  # table not created yet


def _interleave(primary: List[dict], secondary: List[dict], limit: int) -> List[dict]:
    """Merge two ranked lists whose scores are not comparable.

    Cosine similarity and term-overlap counts live on different scales, so they
    are merged by rank (best of each, then second of each) rather than by
    pretending one number means the same as the other.
    """
    merged: List[dict] = []
    for a, b in zip_longest(primary, secondary):
        if a is not None:
            merged.append(a)
        if b is not None:
            merged.append(b)
        if len(merged) >= limit * 2:
            break
    return merged


def _from_stored_chunks(record_ids: List[str], query: str, limit: int) -> Optional[List[dict]]:
    """Semantic passage search over the chunk index, or None if unavailable."""
    query_vec = embed_text(query)
    if query_vec is None:
        return None
    try:
        result = supabase.rpc(
            "match_chunks",
            {
                "query_embedding": query_vec,
                "p_record_ids": record_ids,
                "match_count": limit * 2,
            },
        ).execute()
    except Exception as e:
        # Migration 004 not applied yet, most likely.
        logger.warning("Passage index unavailable, chunking on the fly: %s", e)
        return None

    rows = result.data or []
    if not rows:
        return None
    return [
        {"record_id": row["record_id"], "text": row["content"], "score": row.get("similarity", 0.0)}
        for row in rows
    ]


def _from_ocr_text(record_ids: List[str], query: str) -> List[dict]:
    """Chunk the stored document text and rank the passages by term overlap."""
    terms = tokenize(query)
    if not terms:
        return []
    try:
        rows = (
            supabase.table("records")
            .select("id, raw_ocr_text")
            .in_("id", record_ids)
            .execute()
            .data
            or []
        )
    except Exception as e:
        logger.warning("Could not read document text: %s", e)
        return []

    scored: List[dict] = []
    for row in rows:
        for passage in chunk_document(row.get("raw_ocr_text") or ""):
            score = score_text(passage, terms)
            if score > 0:
                scored.append({"record_id": row["id"], "text": passage, "score": score})
    scored.sort(key=lambda p: -p["score"])
    return scored


def _cap_per_record(passages: List[dict], limit: int) -> List[dict]:
    seen: Dict[str, int] = {}
    kept: List[dict] = []
    for passage in passages:
        record_id = passage["record_id"]
        if seen.get(record_id, 0) >= MAX_PER_RECORD:
            continue
        seen[record_id] = seen.get(record_id, 0) + 1
        kept.append(passage)
        if len(kept) >= limit:
            break
    return kept


def relevant_passages(
    record_ids: List[str], query: str, limit: int = DEFAULT_LIMIT
) -> List[dict]:
    """Passages of the given records' document text most relevant to the query.

    Returns [] when nothing in the text matches, which is the honest answer and
    lets the caller say so instead of handing the model unrelated text.
    """
    if not record_ids or not query.strip():
        return []

    indexed = _indexed_records(record_ids)
    unindexed = [rid for rid in record_ids if rid not in indexed]

    semantic = _from_stored_chunks(sorted(indexed), query, limit) if indexed else None
    if semantic is None:
        # No index, no embedding model, or nothing matched: scan everything.
        return _cap_per_record(_from_ocr_text(record_ids, query), limit)

    scanned = _from_ocr_text(unindexed, query) if unindexed else []
    return _cap_per_record(_interleave(semantic, scanned, limit), limit)
