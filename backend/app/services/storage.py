"""Access to the private `medical-records` storage bucket.

Documents are medical records, so they are NEVER served from a public URL:
callers always get a short-lived signed URL generated at read time. If signing
fails the caller gets ``None`` and the UI shows an "unavailable" state; we
deliberately do not fall back to a public URL, because that would hand out a
permanent unauthenticated link to someone's medical document.
"""
import threading
import time
from typing import Dict, Iterable, List, Optional

from app.database import supabase
from app.logger import logger

BUCKET = "medical-records"
DEFAULT_EXPIRY = 3600

# Signing is a network call to Supabase, and the records list signs every page
# of every record. A URL is valid for an hour, so re-signing the same path on
# every refresh buys nothing: we keep each one until it has a comfortable
# margin left and hand the same URL back. On a warm process this removes the
# signing round-trip from the list and search responses entirely.
#
# What is cached is a URL the caller was already entitled to, keyed by the
# exact storage path, so this can never widen who can see what. Ownership is
# still checked on every request, before anything is signed.
_SIGNED_URL_MARGIN = 600          # stop reusing a URL with under 10 min left
_CACHE_MAX_ENTRIES = 5000         # bounded, so a big account cannot grow it forever

_cache: Dict[str, tuple] = {}     # path -> (url, expires_at_monotonic)
_cache_lock = threading.Lock()


def _cached(path: str) -> Optional[str]:
    entry = _cache.get(path)
    if not entry:
        return None
    url, expires_at = entry
    if time.monotonic() >= expires_at:
        with _cache_lock:
            _cache.pop(path, None)
        return None
    return url


def _remember(path: str, url: Optional[str], expires_in: int) -> None:
    if not url:
        return
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX_ENTRIES:
            _cache.clear()  # cheap and correct: everything is re-signed on demand
        _cache[path] = (url, time.monotonic() + max(expires_in - _SIGNED_URL_MARGIN, 0))


def forget_signed_urls(paths: Iterable[str] = ()) -> None:
    """Drop cached URLs for paths that are going away (a delete), or all of them."""
    with _cache_lock:
        if not paths:
            _cache.clear()
            return
        for path in paths:
            _cache.pop(path, None)


def signed_url(file_path: str, expires_in: int = DEFAULT_EXPIRY) -> Optional[str]:
    """Return a short-lived signed URL for one object, or None if signing fails."""
    if not file_path:
        return None
    hit = _cached(file_path)
    if hit:
        return hit
    try:
        result = supabase.storage.from_(BUCKET).create_signed_url(file_path, expires_in)
        url = result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
    except Exception as e:
        logger.warning("Failed to sign %s: %s", file_path, e)
        return None
    _remember(file_path, url, expires_in)
    return url


def signed_urls(paths: Iterable[str], expires_in: int = DEFAULT_EXPIRY) -> Dict[str, Optional[str]]:
    """Sign many objects in ONE request and return {path: url}.

    The per-object endpoint costs a full HTTPS round-trip each, which made
    listing a profile's records O(number of files) sequential calls. Falls back
    to signing individually only if the batch endpoint is unavailable.
    """
    unique: List[str] = list(dict.fromkeys(p for p in paths if p))
    if not unique:
        return {}

    known = {p: _cached(p) for p in unique}
    missing = [p for p, url in known.items() if not url]
    if not missing:
        return known  # nothing to sign: no network call at all

    try:
        results = supabase.storage.from_(BUCKET).create_signed_urls(missing, expires_in)
        urls = {
            item.get("path"): (item.get("signedURL") or item.get("signedUrl"))
            for item in (results or [])
            if not item.get("error")
        }
        # Only trust the batch result if it actually covered the request.
        if urls:
            for path in missing:
                _remember(path, urls.get(path), expires_in)
            return {p: known[p] or urls.get(p) for p in unique}
    except Exception as e:
        logger.warning("Batch signing unavailable, falling back to per-object: %s", e)

    return {p: known[p] or signed_url(p, expires_in) for p in unique}
