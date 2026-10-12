"""The original documents: checking uploaded files, and keeping them in storage.

Every page is stored under a key derived from its bytes, so the same document
uploaded twice is recognisable instead of becoming a second record. Nothing here
decides what a document *says*; that is record_pipeline.
"""
import hashlib

from app.database import supabase
from app.logger import logger
from app.services.storage import BUCKET

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/jpg", "image/webp",
    "image/gif", "image/bmp", "application/pdf"
}
MAX_SIZE = 10 * 1024 * 1024
# Pages in one request. Each is held in memory while it is checked, so an
# unbounded list could exhaust a small server.
MAX_FILES = 20

# The stored object key must never be built from the user-supplied filename:
# an extension like "pdf/../../other-user" would escape the per-user prefix.
# We derive it from the content type we already verified by magic bytes.
_EXTENSION_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "application/pdf": "pdf",
}
_TYPE_BY_EXTENSION = {ext: ct for ct, ext in _EXTENSION_BY_TYPE.items() if ct != "image/jpg"}

# Magic-byte signatures: the client-supplied content_type header can be spoofed,
# so we verify the actual file bytes match what's claimed before accepting the upload.
_MAGIC_CHECKS = {
    "image/jpeg": lambda b: b[:3] == b"\xff\xd8\xff",
    "image/jpg": lambda b: b[:3] == b"\xff\xd8\xff",
    "image/png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    "image/gif": lambda b: b[:6] in (b"GIF87a", b"GIF89a"),
    "image/bmp": lambda b: b[:2] == b"BM",
    "image/webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
    "application/pdf": lambda b: b[:4] == b"%PDF",
}


class UploadRejected(ValueError):
    """A file that cannot be accepted. The message is safe to show the person."""


def content_matches_type(contents: bytes, content_type: str) -> bool:
    check = _MAGIC_CHECKS.get(content_type)
    return check(contents) if check else False


def content_type_for_path(file_path: str) -> str:
    return _TYPE_BY_EXTENSION.get(file_path.rsplit(".", 1)[-1].lower(), "")


async def validate_uploads(files) -> list:
    """[(bytes, content_type)] for every file, or UploadRejected.

    Every file is checked before anything is stored, so a bad third file cannot
    leave the first two orphaned in the bucket.
    """
    if len(files) > MAX_FILES:
        raise UploadRejected(f"Too many files at once. Up to {MAX_FILES} pages per upload.")
    checked = []
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise UploadRejected(
                f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP, GIF, BMP, PDF"
            )
        # Read at most one byte past the limit: an oversized file is refused
        # without ever being held in memory whole.
        contents = await file.read(MAX_SIZE + 1)
        if len(contents) > MAX_SIZE:
            raise UploadRejected("File too large. Max 10MB per file")
        if not contents:
            raise UploadRejected("That file is empty.")
        if not content_matches_type(contents, file.content_type):
            raise UploadRejected("File content does not match its declared type")
        checked.append((contents, file.content_type))
    return checked


def content_path(user_id: str, profile_id: str, contents: bytes, content_type: str) -> str:
    """Where a document lives: derived from its bytes, not a random id.

    The same photo uploaded twice for the same member lands on the same key, so
    a retried request (a timeout, a double tap, a flaky connection) is
    recognisable as the document we already have instead of becoming a second
    record. Scoped by user and member, so it never links two people's files.
    """
    digest = hashlib.sha256(contents).hexdigest()
    return f"{user_id}/{profile_id}/{digest}.{_EXTENSION_BY_TYPE[content_type]}"


async def prepare_entries(files, user_id: str, profile_id: str) -> list:
    """Validated pages as storage entries, each page once even if picked twice."""
    entries = []
    for contents, content_type in await validate_uploads(files):
        path = content_path(user_id, profile_id, contents, content_type)
        if any(e["file_path"] == path for e in entries):
            continue  # the same page picked twice in one upload
        entries.append({"file_path": path, "contents": contents, "content_type": content_type})
    return entries


def records_holding(paths: list, profile_id: str) -> dict:
    """{file_path: record_id} for paths already attached to one of this member's records."""
    if not paths:
        return {}
    rows = supabase.table("record_files").select("record_id, file_path").in_("file_path", paths).execute().data or []
    if not rows:
        return {}
    owned = supabase.table("records").select("id").eq("profile_id", profile_id).in_(
        "id", list({r["record_id"] for r in rows})
    ).execute().data or []
    owned_ids = {r["id"] for r in owned}
    return {r["file_path"]: r["record_id"] for r in rows if r["record_id"] in owned_ids}


def store(entries: list) -> None:
    for entry in entries:
        # upsert: the key is the content hash, so overwriting can only ever
        # write the same bytes. It makes a replayed request harmless.
        supabase.storage.from_(BUCKET).upload(
            path=entry["file_path"],
            file=entry["contents"],
            file_options={"content-type": entry["content_type"], "upsert": "true"},
        )


def discard(paths: list) -> None:
    """Remove objects a failed request stored, so no orphan outlives it.

    Keys are content hashes, so a concurrent identical upload writes the very
    same key. A path some record already points to belongs to that record and
    is never removed here; only an unreferenced object is an orphan.
    """
    if not paths:
        return
    try:
        held = supabase.table("record_files").select("file_path").in_("file_path", paths).execute().data or []
        paths = [p for p in paths if p not in {h["file_path"] for h in held}]
    except Exception:
        return  # unsure whether they are in use: an orphan is cheaper than a lost document
    if not paths:
        return
    try:
        supabase.storage.from_(BUCKET).remove(paths)
    except Exception as e:
        logger.warning("Could not clean up %d stored file(s) after a failed upload: %s", len(paths), e)


def record_pages(record: dict) -> list:
    """A record's pages in order, including legacy records that only have file_path."""
    files = (
        supabase.table("record_files").select("file_path, page_number")
        .eq("record_id", record["id"]).order("page_number").execute().data or []
    )
    paths = [f["file_path"] for f in files if f.get("file_path")]
    if not paths and record.get("file_path"):
        paths = [record["file_path"]]
    return paths
