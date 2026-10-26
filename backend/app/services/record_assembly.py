"""Fill in the related data a record needs before it goes back to the client.

Shared by the records and search endpoints so both return the same shape, including
particular, both must hand out freshly signed document URLs rather than
anything stored in the database.
"""
from concurrent.futures import ThreadPoolExecutor

from app.database import supabase
from app.logger import logger
from app.services.storage import signed_urls

BASE_RECORD_COLUMNS = (
    "id, profile_id, document_type, status, file_path, doctor_name, "
    "hospital_name, document_date, specialty, diagnosis, recommendations, "
    "document_category, bill_amount, insurance_claimed, visit_group, "
    "created_at, updated_at"
)
BILL_DETAIL_COLUMNS = "bill_title, bill_category, bill_number"

# None = not known yet. Only a definite "column does not exist" answer is
# remembered; a network error is not a reason to stop asking.
_bill_columns = None


def has_bill_columns() -> bool:
    """Whether migration 005 (bill title, category and number) has been applied.

    The editor has always let people type these, but no migration ever created
    the columns, so the value was dropped and the list never returned it: a bill
    title vanished on the next refresh. Asked once, so the app works the same
    before and after the migration is run.
    """
    global _bill_columns
    if _bill_columns is not None:
        return _bill_columns
    try:
        supabase.table("records").select(BILL_DETAIL_COLUMNS).limit(1).execute()
        _bill_columns = True
    except Exception as e:
        message = str(e).lower()
        if "does not exist" in message or "42703" in message or "column" in message:
            _bill_columns = False
            logger.info("Bill detail columns missing; apply migration 005 to store them")
        else:
            return False
    return _bill_columns


def record_columns() -> str:
    return BASE_RECORD_COLUMNS + (", " + BILL_DETAIL_COLUMNS if has_bill_columns() else "")


def attach_related(records: list) -> list:
    """Attach medicines and pages, fetching both at the same time.

    Each is a separate HTTPS round-trip to Supabase, and they do not depend on
    each other, so waiting for the first before starting the second added a
    whole round-trip to every records list and every search. Both still run on
    the same records; the result is identical, it just arrives sooner.
    """
    if not records:
        return records
    with ThreadPoolExecutor(max_workers=2) as pool:
        medicines = pool.submit(attach_medicines, records)
        files = pool.submit(attach_files, records)
        # Both write into the same record dicts, under different keys. Results
        # are read so that a failure in either is raised here, as it would be
        # if they had run one after the other.
        medicines.result()
        files.result()
    return records


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
