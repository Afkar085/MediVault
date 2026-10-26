"""Refresh tokens: what actually keeps someone signed in.

The access token is a short-lived JWT, so a stolen one stops working within the
hour. Staying signed in across a reload or a browser restart is the refresh
token's job, and it is deliberately not a JWT:

* it is an opaque random string, so nothing can be read out of it;
* only its SHA-256 hash is stored, so this table leaking does not hand anyone a
  session;
* it is **rotated** on every use, and the one it replaced is marked used;
* presenting an already-used token means a copy was replayed, so every token
  descended from that sign-in (its "family") is revoked at once. The real user
  is signed out of that device, which is the right outcome when a token has
  demonstrably been copied.

Everything here degrades to "no session" rather than to "an error": if the
table is unreachable the caller gets None and the user signs in again, which is
inconvenient but never wrong.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from app.config import settings
from app.database import supabase
from app.logger import logger

TABLE = "refresh_tokens"

# Long enough that a phone left alone for a few weeks is still signed in, short
# enough that an abandoned device does not stay valid forever.
REFRESH_TOKEN_BYTES = 48


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(raw: str) -> str:
    """Tokens are compared by hash, never stored or logged in the clear."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue(user_id: str, family_id: Optional[str] = None) -> Optional[str]:
    """Mint a refresh token for this user and return the raw value, once."""
    raw = secrets.token_urlsafe(REFRESH_TOKEN_BYTES)
    expires = _now() + timedelta(days=settings.REFRESH_TOKEN_DAYS)
    try:
        supabase.table(TABLE).insert({
            "user_id": user_id,
            "token_hash": _hash(raw),
            "family_id": family_id or str(uuid.uuid4()),
            "expires_at": expires.isoformat(),
        }).execute()
    except Exception as e:
        # Signing in still works; the session just will not outlive the access
        # token. Better than refusing the login outright.
        logger.warning("Could not store a refresh token for %s: %s", user_id, e)
        return None
    return raw


def _revoke_family(family_id: str) -> None:
    try:
        supabase.table(TABLE).update({"revoked_at": _now().isoformat()}) \
            .eq("family_id", family_id).is_("revoked_at", "null").execute()
    except Exception as e:
        logger.warning("Could not revoke token family %s: %s", family_id, e)


def rotate(raw: str) -> Optional[Tuple[str, str]]:
    """Exchange a refresh token for (user_id, a new refresh token).

    Returns None whenever the token is not currently usable: unknown, expired,
    revoked, or already spent. A spent token also ends its whole family, since
    the only way to present one twice is for a copy to exist.
    """
    if not raw:
        return None
    try:
        rows = supabase.table(TABLE).select(
            "id, user_id, family_id, expires_at, used_at, revoked_at"
        ).eq("token_hash", _hash(raw)).limit(1).execute().data or []
    except Exception as e:
        logger.warning("Could not look up a refresh token: %s", e)
        return None

    if not rows:
        return None
    row = rows[0]

    if row.get("revoked_at"):
        return None
    if row.get("used_at"):
        logger.warning("Refresh token replayed; revoking session family %s", row["family_id"])
        _revoke_family(row["family_id"])
        return None
    if _expired(row.get("expires_at")):
        return None

    # Mark this one spent before minting its replacement, and only for a row
    # that is still unused: two tabs refreshing at the same instant must not
    # both succeed and leave two live tokens behind.
    try:
        claimed = supabase.table(TABLE).update({"used_at": _now().isoformat()}) \
            .eq("id", row["id"]).is_("used_at", "null").execute().data
    except Exception as e:
        logger.warning("Could not claim refresh token %s: %s", row["id"], e)
        return None
    if not claimed:
        return None

    new_raw = issue(row["user_id"], row["family_id"])
    if not new_raw:
        return None
    return row["user_id"], new_raw


def revoke(raw: str) -> None:
    """Sign this session out. Unknown tokens are silently fine."""
    if not raw:
        return
    try:
        supabase.table(TABLE).update({"revoked_at": _now().isoformat()}) \
            .eq("token_hash", _hash(raw)).execute()
    except Exception as e:
        logger.warning("Could not revoke a refresh token: %s", e)


def revoke_all(user_id: str) -> None:
    """Sign every device out. Used when the account itself is going away."""
    try:
        supabase.table(TABLE).update({"revoked_at": _now().isoformat()}) \
            .eq("user_id", user_id).is_("revoked_at", "null").execute()
    except Exception as e:
        logger.warning("Could not revoke sessions for %s: %s", user_id, e)


def _expired(value) -> bool:
    if not value:
        return True
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed <= _now()
