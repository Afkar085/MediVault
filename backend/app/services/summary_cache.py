"""Remember a generated summary until the records behind it change.

The health journey summary is a pure function of the records that fed it, so
regenerating it on every visit costs seconds of latency and tokens for an answer
we already had. Keyed on a fingerprint of those records, so any upload, edit or
deletion invalidates it automatically — no TTL to tune and no stale summaries.

In-process on purpose: it needs no migration and no extra service. A restart or
a second worker just means a cache miss, which is the current behaviour anyway.
"""
import hashlib
from collections import OrderedDict
from typing import List, Optional

MAX_ENTRIES = 128

_cache: "OrderedDict[str, str]" = OrderedDict()


def fingerprint(records: List[dict]) -> str:
    """Identify exactly this set of records in exactly this state."""
    parts = [
        f"{r.get('id')}:{r.get('updated_at') or r.get('created_at')}"
        for r in sorted(records, key=lambda r: str(r.get("id")))
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _key(profile_id: str, records_fingerprint: str) -> str:
    return f"{profile_id}:{records_fingerprint}"


def get(profile_id: str, records_fingerprint: str) -> Optional[str]:
    key = _key(profile_id, records_fingerprint)
    if key not in _cache:
        return None
    _cache.move_to_end(key)
    return _cache[key]


def put(profile_id: str, records_fingerprint: str, summary: str) -> None:
    if not summary:
        return
    key = _key(profile_id, records_fingerprint)
    _cache[key] = summary
    _cache.move_to_end(key)
    while len(_cache) > MAX_ENTRIES:
        _cache.popitem(last=False)


def clear() -> None:
    _cache.clear()
