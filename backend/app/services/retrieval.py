"""Hybrid retrieval: combine keyword ranking with vector similarity.

Vector search is delegated to a Postgres RPC (``match_records``, see
database/migrations/001_semantic_search.sql) backed by pgvector. If embeddings
or the RPC are unavailable (e.g. migration not yet applied), the vector helpers
return None and the caller falls back to keyword-only search.
"""
import logging
from typing import List, Optional

from app.database import supabase
from app.services.embeddings import embed_text

logger = logging.getLogger(__name__)


def vector_search(
    profile_ids: List[str], query: str, limit: int = 20
) -> Optional[List[str]]:
    """Return record ids ranked by semantic similarity, or None if unavailable."""
    query_vec = embed_text(query)
    if query_vec is None:
        return None
    try:
        res = supabase.rpc(
            "match_records",
            {
                "query_embedding": query_vec,
                "p_profile_ids": profile_ids,
                "match_count": limit,
            },
        ).execute()
        return [row["id"] for row in (res.data or [])]
    except Exception as e:
        # Most likely the migration hasn't been applied yet. Don't break search.
        logger.warning("Vector search unavailable (run the migration?): %s", e)
        return None


def reciprocal_rank_fusion(rankings: List[List[str]], k: int = 60) -> List[str]:
    """Merge multiple ranked id-lists into one using Reciprocal Rank Fusion.

    RRF score for an item = sum over rankings of 1 / (k + rank). Robust because
    it needs only ranks, not comparable scores across the two systems.
    """
    scores: dict = {}
    for ranking in rankings:
        for rank, item_id in enumerate(ranking):
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k + rank + 1)
    return [item_id for item_id, _ in sorted(scores.items(), key=lambda x: -x[1])]
