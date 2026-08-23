"""Access to the private `medical-records` storage bucket.

Documents are medical records, so they are NEVER served from a public URL:
callers always get a short-lived signed URL generated at read time. If signing
fails the caller gets ``None`` and the UI shows an "unavailable" state — we
deliberately do not fall back to a public URL, because that would hand out a
permanent unauthenticated link to someone's medical document.
"""
from typing import Dict, Iterable, List, Optional

from app.database import supabase
from app.logger import logger

BUCKET = "medical-records"
DEFAULT_EXPIRY = 3600


def signed_url(file_path: str, expires_in: int = DEFAULT_EXPIRY) -> Optional[str]:
    """Return a short-lived signed URL for one object, or None if signing fails."""
    if not file_path:
        return None
    try:
        result = supabase.storage.from_(BUCKET).create_signed_url(file_path, expires_in)
        return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
    except Exception as e:
        logger.warning("Failed to sign %s: %s", file_path, e)
        return None


def signed_urls(paths: Iterable[str], expires_in: int = DEFAULT_EXPIRY) -> Dict[str, Optional[str]]:
    """Sign many objects in ONE request and return {path: url}.

    The per-object endpoint costs a full HTTPS round-trip each, which made
    listing a profile's records O(number of files) sequential calls. Falls back
    to signing individually only if the batch endpoint is unavailable.
    """
    unique: List[str] = list(dict.fromkeys(p for p in paths if p))
    if not unique:
        return {}

    try:
        results = supabase.storage.from_(BUCKET).create_signed_urls(unique, expires_in)
        urls = {
            item.get("path"): (item.get("signedURL") or item.get("signedUrl"))
            for item in (results or [])
            if not item.get("error")
        }
        # Only trust the batch result if it actually covered the request.
        if urls:
            return {p: urls.get(p) for p in unique}
    except Exception as e:
        logger.warning("Batch signing unavailable, falling back to per-object: %s", e)

    return {p: signed_url(p, expires_in) for p in unique}
