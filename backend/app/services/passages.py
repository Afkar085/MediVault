"""Retrieve the actual text of a document, not just its extracted fields.

Structured retrieval answers "which visit was this?"; it cannot answer "what was
the haemoglobin value?", because that number lives in the scanned text and was
never extracted into a column. This module returns the passages of that text
which are most relevant to a question, so the model can answer from the document
itself and cite it.

Two backends, in order:

1. Stored chunks with embeddings (migration 004 + pgvector) — semantic, so
   "sugar" finds "glucose".
2. Chunking the stored OCR text on the fly and ranking passages by term overlap.

The second needs no migration, no extra service and no embedding model, so
document-grounded answers work on the smallest host. The first is strictly an
improvement on top.

Callers pass record ids they have *already* authorized; nothing here widens
scope on its own.
"""
import logging
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

    Returns [] when nothing in the text matches — which is the honest answer, and
    lets the caller say so instead of handing the model unrelated text.
    """
    if not record_ids or not query.strip():
        return []
    found = _from_stored_chunks(record_ids, query, limit) or _from_ocr_text(record_ids, query)
    return _cap_per_record(found, limit)
