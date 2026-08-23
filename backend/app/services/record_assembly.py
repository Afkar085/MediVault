"""Fill in the related data a record needs before it goes back to the client.

Shared by the records and search endpoints so both return the same shape — in
particular, both must hand out freshly signed document URLs rather than
anything stored in the database.
"""
from app.database import supabase
from app.services.storage import signed_urls


def attach_medicines(records: list) -> list:
    if not records:
        return records
    record_ids = [r["id"] for r in records]
    result = supabase.table("medicines").select("*").in_("record_id", record_ids).execute()
    by_record: dict = {}
    for medicine in result.data:
        by_record.setdefault(medicine["record_id"], []).append(medicine)
    for record in records:
        record["medicines"] = by_record.get(record["id"], [])
    return records


def attach_files(records: list) -> list:
    """Attach each record's pages with short-lived signed URLs.

    Every path is signed in a single batch request; signing them one at a time
    cost one HTTPS round-trip per page and dominated list latency.
    """
    if not records:
        return records
    record_ids = [r["id"] for r in records]
    result = (
        supabase.table("record_files")
        .select("id, record_id, file_path, page_number, created_at")
        .in_("record_id", record_ids)
        .order("page_number")
        .execute()
    )

    paths = [f["file_path"] for f in result.data if f.get("file_path")]
    paths += [r["file_path"] for r in records if r.get("file_path")]
    url_by_path = signed_urls(paths)

    by_record: dict = {}
    for file_row in result.data:
        file_row["file_url"] = url_by_path.get(file_row.get("file_path"))
        by_record.setdefault(file_row["record_id"], []).append(file_row)
    for record in records:
        record["files"] = by_record.get(record["id"], [])
        record["file_url"] = url_by_path.get(record.get("file_path"))
    return records
