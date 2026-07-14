from app.database import supabase
from app.logger import logger

BUCKET = "medical-records"


def signed_url(file_path: str, expires_in: int = 3600) -> str:
    """Generate a short-lived signed URL for a private storage object.

    Falls back to the (long-lived) public URL if signing fails — e.g. if the
    bucket is still set to public in the Supabase dashboard, create_signed_url
    still works but callers relying on a public bucket for public_url won't
    break during the migration to a private bucket.
    """
    try:
        result = supabase.storage.from_(BUCKET).create_signed_url(file_path, expires_in)
        url = result.get("signedURL") or result.get("signed_url")
        if url:
            return url
    except Exception as e:
        logger.warning("Failed to create signed URL for %s: %s", file_path, e)
    return supabase.storage.from_(BUCKET).get_public_url(file_path)


def attach_signed_urls(files: list) -> list:
    for f in files:
        path = f.get("file_path")
        if path:
            f["file_url"] = signed_url(path)
    return files
