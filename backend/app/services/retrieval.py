"""Finding the records that are relevant to a query.

Two independent rankers:

* ``vector_search``: semantic, delegated to a Postgres RPC (``match_records``,
  see database/migrations/001_semantic_search.sql) backed by pgvector. Needs the
  embedding model, which does not fit on every host, so it returns None when
  unavailable and callers fall back.
* ``keyword_rank``: term overlap, pure Python over records already loaded. No
  model, no extra query. This is what makes retrieval work on a small host.

``reciprocal_rank_fusion`` merges them when both are available.
"""
import logging
import re
from typing import Dict, List, Optional

from app.database import supabase
from app.services.embeddings import embed_text

logger = logging.getLogger(__name__)

# Words that appear in almost every question and would otherwise match every
# record. Kept deliberately small; anything clinical must survive.
_STOPWORDS = frozenset("""
a an and any are as at be been being but by can did do does for from get give
had has have he her him his how i in into is it its me my of on or our out she
show tell that the their them then there these they this to under was we were
what when where which who whom why will with would you your about all also
""".split())

# Fields searched for query terms, weighted by how strongly a match there
# indicates the record is the one being asked about.
_FIELD_WEIGHTS = (
    ("doctor_name", 6),
    ("specialty", 5),
    ("diagnosis", 5),
    ("hospital_name", 4),
    ("recommendations", 3),
    ("document_type", 2),
    ("document_category", 2),
    ("raw_ocr_text", 1),
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> List[str]:
    """Lowercase word tokens with stopwords and single characters removed."""
    if not text:
        return []
    return [t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 1 and t not in _STOPWORDS]


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


def score_text(text: str, terms: List[str]) -> float:
    """How many distinct query terms a passage contains, weighted by repetition.

    Distinct coverage dominates: a passage mentioning both "haemoglobin" and
    "iron" beats one that says "haemoglobin" five times.
    """
    if not text or not terms:
        return 0.0
    haystack = text.lower()
    score = 0.0
    for term in set(terms):
        occurrences = haystack.count(term)
        if occurrences:
            score += 3.0 + min(occurrences - 1, 3) * 0.5
    return score


def score_record(record: dict, terms: List[str], medicines: Optional[list] = None) -> float:
    """How well one record answers a query, from term overlap alone.

    A term found in several fields counts once per field, so a record whose
    doctor *and* diagnosis both match a term outranks one that only mentions it
    in the scanned text.
    """
    if not terms:
        return 0.0

    score = 0.0
    for field, weight in _FIELD_WEIGHTS:
        value = record.get(field)
        if not value:
            continue
        haystack = str(value).lower()
        for term in terms:
            if term in haystack:
                score += weight

    for medicine in medicines or record.get("medicines") or []:
        name = (medicine.get("name") or "").lower()
        for term in terms:
            if term and term in name:
                score += 7

    date_text = f"{record.get('document_date') or ''} {record.get('created_at') or ''}".lower()
    for term in terms:
        if len(term) == 4 and term.isdigit() and term in date_text:
            score += 4

    return score


def keyword_rank(
    records: List[dict],
    query: str,
    medicines_by_record: Optional[Dict[str, list]] = None,
    limit: Optional[int] = None,
) -> List[dict]:
    """Rank records by term overlap with the query, best first.

    Records that match nothing are dropped rather than padded in: answering
    from an unrelated record is worse than saying nothing was found.
    """
    terms = tokenize(query)
    if not terms:
        return []

    scored = []
    for record in records:
        medicines = (medicines_by_record or {}).get(record["id"]) if medicines_by_record else None
        score = score_record(record, terms, medicines)
        if score > 0:
            scored.append((score, record))

    scored.sort(key=lambda pair: -pair[0])
    ranked = [record for _, record in scored]
    return ranked[:limit] if limit else ranked


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


def select_context_records(
    records: List[dict],
    query: str,
    limit: Optional[int] = None,
) -> List[dict]:
    """The records to put in front of the model for this question.

    Term overlap decides the order, so a question naming a doctor or a medicine
    is answered from those records first. When nothing overlaps at all the
    caller still gets the most recent records rather than an empty list.

    Refusing outright was wrong: a question can be perfectly answerable and
    share no word with the documents. "What medicines am I on" has no term in
    common with "Paracetamol", and a question asked in another language has
    none in common with anything, yet both used to be answered "not in your
    records" while the prescriptions sat right there. The prompt already tells
    the model to say so when the answer genuinely is not in what it was given,
    so letting it look is more useful and no less honest than not looking.

    ``records`` is expected newest-first, which is the order the fallback keeps.
    """
    ranked = keyword_rank(records, query, limit=limit)
    if ranked:
        return ranked
    return records[:limit] if limit else records
