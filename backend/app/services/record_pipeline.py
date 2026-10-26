"""Reading a record's documents and filling in what they say.

Runs as a background task after an upload, a retry or added pages, and on
demand for a re-extraction. Every path here is safe to run more than once on the
same record: it only fills fields that are still empty (what the person typed or
edited always wins) and never adds a medicine the record already has.
"""
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.database import supabase
from app.logger import logger
from app.services.chunking import chunk_document
from app.services.ocr import OcrUnavailable, extract_text_from_bytes
from app.services.storage import BUCKET

# Fields the extractor may fill in. It only ever fills a field that is still
# empty: anything the person typed at upload time, or edited since, wins.
EXTRACTED_FIELDS = ("document_type", "doctor_name", "hospital_name", "document_date",
                    "specialty", "diagnosis", "recommendations", "document_category")

PAGE_BREAK = "\n\n--- Page Break ---\n\n"

# Each page is an independent network round-trip plus a vision call, so reading
# them one after another made a five-page upload take five times as long as it
# needed to. Bounded, because the vision API is rate limited and one upload must
# not be able to exhaust that for everyone.
MAX_CONCURRENT_PAGES = 4

_DOCTOR_MARKERS = re.compile(r"\b(dr|doctor|mbbs|md|ms|consultant|physician|surgeon)\b", re.I)


def now() -> str:
    """A timestamp for updated_at, which is also the clock the stuck-job timeout reads."""
    return datetime.now(timezone.utc).isoformat()


def _slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def norm_med(name: str) -> str:
    """Normalise a medicine name to its brand token, so 'AZEE' and 'AZEE 500MG
    TABLET' collapse to the same key when de-duplicating across merged pages."""
    return re.sub(r'[^a-z0-9]+', ' ', (name or '').lower()).strip().split(' ')[0]


def med_key(name: str) -> str:
    """The whole normalised name. Used within one document, where 'AZEE 250' and
    'AZEE 500' on the same prescription are two different instructions."""
    return re.sub(r'[^a-z0-9]+', ' ', (name or '').lower()).strip()


# ── which extracted values are kept ─────────────────────────────────────────

def _accept_extracted(field: str, value, category) -> bool:
    """Whether an extracted value may be stored.

    On a bill the "doctor" the model returns is usually the shop, restaurant or
    hospital that issued it. Only a name that reads as a doctor's is kept there.
    """
    if field == "doctor_name" and category == "bill":
        return bool(_DOCTOR_MARKERS.search(str(value)))
    return True


def _blank(record: dict, field: str) -> bool:
    value = record.get(field)
    if field == "document_type":
        return not value or value == "Unknown"
    return value is None or value == ""


def fields_to_fill(record: dict, data: dict) -> dict:
    """The extracted values for the fields this record is still missing."""
    category = record.get("document_category") or data.get("document_category")
    return {
        field: data[field] for field in EXTRACTED_FIELDS
        if data.get(field) and _blank(record, field) and _accept_extracted(field, data[field], category)
    }


def _compute_visit_group(profile_id: str, doctor_name: str, doc_date_str: str) -> str:
    if not doctor_name:
        return None
    slug = _slugify(doctor_name)
    today = datetime.now(timezone.utc).date()
    try:
        doc_date = datetime.strptime(doc_date_str, "%Y-%m-%d").date() if doc_date_str else today
    except ValueError:
        doc_date = today

    window_start = (doc_date - timedelta(days=7)).isoformat()
    window_end = (doc_date + timedelta(days=7)).isoformat()
    existing = (
        supabase.table("records")
        .select("visit_group, document_date")
        .eq("profile_id", profile_id)
        .ilike("doctor_name", doctor_name)
        .gte("document_date", window_start)
        .lte("document_date", window_end)
        .not_.is_("visit_group", "null")
        .limit(1)
        .execute()
    )
    if existing.data and existing.data[0].get("visit_group"):
        return existing.data[0]["visit_group"]
    return f"{slug}_{doc_date.isoformat()}"


# ── medicines ───────────────────────────────────────────────────────────────

def medicine_rows(record_id: str, medicines: list, existing_keys: set, key=med_key) -> list:
    """New medicine rows, skipping any already on the record or repeated in the list.

    Running extraction again (a retry, a re-read) must never stack a second copy
    of the same prescription on the record, and models do sometimes list one line
    twice.
    """
    seen = set(existing_keys)
    rows = []
    for m in medicines or []:
        # Models sometimes list medicines as plain strings. Those used to be
        # skipped, leaving an empty Medicines list beside scanned text that
        # named them. A string is kept as the name; nothing else is guessed.
        if isinstance(m, str):
            m = {"name": m}
        if not isinstance(m, dict):
            continue
        name = (m.get("name") or "").strip()
        k = key(name)
        if not k or k in seen:
            continue
        seen.add(k)
        rows.append({
            "record_id": record_id,
            "name": name,
            "dosage": m.get("dosage") or None,
            "frequency": m.get("frequency") or None,
            "duration": m.get("duration") or None,
        })
    return rows


def existing_medicine_keys(record_id: str, key=med_key) -> set:
    rows = supabase.table("medicines").select("name").eq("record_id", record_id).execute().data or []
    return {key(m.get("name")) for m in rows}


# ── reading pages and indexing text ─────────────────────────────────────────

# What reading one page produced. `unavailable` means the reading service
# failed, which is not the same as the page having no text on it, and the two
# must not be reported to the user the same way.
class PageResult:
    __slots__ = ("text", "unavailable")

    def __init__(self, text: str = "", unavailable: bool = False):
        self.text = text
        self.unavailable = unavailable


def _read_page(entry: dict, content_type: str) -> PageResult:
    """OCR one page. Never raises: a page that fails must not lose the others."""
    started = time.monotonic()
    try:
        file_bytes = supabase.storage.from_(BUCKET).download(entry["file_path"])
    except Exception as e:
        logger.warning("Could not fetch page %s: %s", entry.get("file_path"), e)
        return PageResult(unavailable=True)
    downloaded = time.monotonic()
    try:
        text = extract_text_from_bytes(file_bytes, content_type)
    except OcrUnavailable as e:
        logger.warning("Reading service unavailable for page %s: %s", entry.get("file_path"), e)
        return PageResult(unavailable=True)
    except Exception as e:
        logger.warning("Could not read page %s: %s", entry.get("file_path"), e)
        return PageResult(unavailable=True)
    logger.info(
        "Page read: download %.2fs, ocr %.2fs, %d characters",
        downloaded - started, time.monotonic() - downloaded, len(text),
    )
    return PageResult(text=text)


def read_pages(file_entries: list, content_types: list) -> list:
    """OCR every page, concurrently, in page order."""
    pairs = [
        (entry, content_types[i] if i < len(content_types) else "")
        for i, entry in enumerate(file_entries)
    ]
    started = time.monotonic()
    if len(pairs) <= 1:
        results = [_read_page(entry, ct) for entry, ct in pairs]
    else:
        with ThreadPoolExecutor(max_workers=min(MAX_CONCURRENT_PAGES, len(pairs))) as pool:
            # map preserves input order, which is the page order.
            results = list(pool.map(lambda pair: _read_page(*pair), pairs))
    logger.info("Read %d page(s) in %.2fs", len(pairs), time.monotonic() - started)
    return results


def page_texts(results: list) -> list:
    return [r.text for r in results]


def any_unavailable(results: list) -> bool:
    return any(r.unavailable for r in results)


def index_passages(record_id: str, text: str) -> None:
    """Store the document split into retrievable passages.

    Best-effort in both directions: if the table is missing (migration 004 not
    applied) nothing is stored and retrieval chunks the OCR text on the fly
    instead; if the embedding model is missing the passages are still stored so
    they can be term-matched.
    """
    passages = chunk_document(text)
    if not passages:
        return

    try:
        from app.services.embeddings import embed_text
    except Exception:  # pragma: no cover - import guard
        embed_text = None

    rows = []
    for index, content in enumerate(passages):
        row = {"record_id": record_id, "chunk_index": index, "content": content}
        if embed_text is not None:
            try:
                vector = embed_text(content)
                if vector is not None:
                    row["embedding"] = vector
            except Exception:
                pass  # a passage without a vector is still term-searchable
        rows.append(row)

    try:
        supabase.table("document_passages").delete().eq("record_id", record_id).execute()
        supabase.table("document_passages").insert(rows).execute()
    except Exception as e:
        logger.info("Passage index unavailable for record %s (run migration 004?): %s", record_id, e)


def _refresh_embedding(record: dict, text: str, medicines: list) -> None:
    # Best-effort: without embeddings the record is still found by keyword search.
    try:
        from app.services.embeddings import build_record_text, embed_text

        record_for_text = dict(record)
        record_for_text["raw_ocr_text"] = text
        embedding = embed_text(build_record_text(record_for_text, medicines))
        if embedding is not None:
            supabase.table("records").update({"embedding": embedding}).eq("id", record["id"]).execute()
    except Exception as embed_err:
        logger.warning("Embedding skipped for record %s: %s", record.get("id"), embed_err)


def _extract(text: str) -> dict:
    # Looked up at call time, so the extractor can be swapped in tests.
    from app.services.ai_extractor import extract_medical_data
    return extract_medical_data(text)


def _extract_or_nothing(text: str) -> dict:
    """The details the document gives up, or {} if the extractor would not.

    Reading the document and understanding it are two steps against two
    different models, and the second failing is no reason to throw the first
    away. It used to be: an extraction error propagated, the whole record was
    marked failed, and a prescription whose text had been read perfectly well
    was shown as "couldn't be read". Now the text, which is what search and
    Ask Your Records run on, is kept and the details are simply left blank for
    the person to fill in.
    """
    try:
        return _extract(text)
    except Exception as e:
        logger.warning("Extraction failed; keeping the document text: %s", type(e).__name__)
        return {}


# ── why a record failed ─────────────────────────────────────────────────────
#
# "failed" alone told the person their document could not be read, whatever had
# actually gone wrong. When the vision model was retired that message was shown
# for perfectly clear prescriptions, and the only advice the app could give was
# to try again with a better photo, which could never work. The reason is
# stored so the screen can say which of the two it was.

UNREADABLE = "unreadable"        # we looked at the document and found no text
SERVICE_DOWN = "service_unavailable"  # we never managed to look

# Older deployments have no failure_reason column (migration 008). Asked once,
# so the pipeline works the same either way.
_has_reason_column = None


class _NothingRead(RuntimeError):
    def __init__(self, service_down: bool):
        super().__init__("service unavailable" if service_down else "no text on any page")
        self.reason = SERVICE_DOWN if service_down else UNREADABLE


def failure_reason(error: Exception) -> str:
    """What to tell the person about a failure. Anything we cannot attribute to
    the document itself is a service problem, because that is the safer
    mistake: it invites a retry rather than blaming a readable document."""
    return getattr(error, "reason", SERVICE_DOWN)


def _reason_column_exists() -> bool:
    global _has_reason_column
    if _has_reason_column is not None:
        return _has_reason_column
    try:
        supabase.table("records").select("failure_reason").limit(1).execute()
        _has_reason_column = True
    except Exception as e:
        if "column" in str(e).lower() or "42703" in str(e):
            _has_reason_column = False
            logger.info("No failure_reason column; apply migration 008 to store why a read failed")
        else:
            return False
    return _has_reason_column


def _clear_reason() -> dict:
    return {"failure_reason": None} if _reason_column_exists() else {}


def _mark_failed(record_id: str, reason: str) -> None:
    update = {"status": "failed", "updated_at": now()}
    if _reason_column_exists():
        update["failure_reason"] = reason
    supabase.table("records").update(update).eq("id", record_id).execute()


# ── the jobs ────────────────────────────────────────────────────────────────

def process_ocr(record_id: str, file_entries: list, content_types: list):
    """Read a record's pages and fill in what the documents say.

    Safe to run more than once on the same record (that is what a retry does):
    it only fills empty fields, and never adds a medicine the record already has.
    """
    started = time.monotonic()
    try:
        results = read_pages(file_entries, content_types)
        all_texts = page_texts(results)
        if not any(t.strip() for t in all_texts):
            # Nothing was read. WHY decides what the person is told: a document
            # we looked at and found blank is not the same as one we never
            # managed to look at because the reading service was down.
            raise _NothingRead(service_down=any_unavailable(results))

        combined_text = PAGE_BREAK.join(t for t in all_texts if t.strip())

        supabase.table("records").update({
            "raw_ocr_text": combined_text,
            "status": "extracting",
            "updated_at": now(),
        }).eq("id", record_id).execute()

        extract_started = time.monotonic()
        data = _extract_or_nothing(combined_text)
        logger.info(
            "Extraction took %.2fs (%s)", time.monotonic() - extract_started,
            "filled" if data else "nothing read back",
        )

        current = supabase.table("records").select(
            "id, profile_id, visit_group, bill_amount, " + ", ".join(EXTRACTED_FIELDS)
        ).eq("id", record_id).execute().data
        if not current:
            logger.info("Record %s was deleted while it was being read", record_id)
            return
        record = current[0]

        update_data = fields_to_fill(record, data)

        bill_amount = data.get("bill_amount")
        if bill_amount is not None and record.get("bill_amount") is None:
            try:
                update_data["bill_amount"] = float(bill_amount)
            except (ValueError, TypeError):
                pass

        merged = {**record, **update_data}
        if merged.get("doctor_name") and not record.get("visit_group"):
            vg = _compute_visit_group(record["profile_id"], merged["doctor_name"], merged.get("document_date") or "")
            if vg:
                update_data["visit_group"] = vg

        rows = medicine_rows(record_id, data.get("medicines"), existing_medicine_keys(record_id))
        if rows:
            supabase.table("medicines").insert(rows).execute()

        # "done" is written last, so the record never claims to be finished
        # while its medicines are still missing.
        supabase.table("records").update(
            {**update_data, "status": "done", **_clear_reason(), "updated_at": now()}
        ).eq("id", record_id).execute()

        _refresh_embedding({**merged, **update_data}, combined_text, data.get("medicines") or [])
        index_passages(record_id, combined_text)
        logger.info("Record %s read and filled in %.2fs", record_id, time.monotonic() - started)

    except Exception as e:
        # The reason is logged; the document text is not (it is medical data).
        logger.error(
            "OCR/extraction pipeline failed for record %s after %.2fs: %s",
            record_id, time.monotonic() - started, type(e).__name__ + ": " + str(e)[:200],
        )
        # Only the status changes: if OCR succeeded and extraction failed, the
        # text we did get is still worth keeping. The original file is untouched.
        _mark_failed(record_id, failure_reason(e))


def reextract(record: dict) -> dict:
    """Read the details again from a record's scanned text. No new OCR.

    Fills only what is empty and adds only medicines the record does not have,
    so running it twice changes nothing. Extraction errors propagate: the
    caller decides how to report them.
    """
    record_id = record["id"]
    data = _extract(record["raw_ocr_text"])
    update_data = fields_to_fill(record, data)
    new_rows = medicine_rows(record_id, data.get("medicines"), existing_medicine_keys(record_id))
    if new_rows:
        supabase.table("medicines").insert(new_rows).execute()
    if update_data or new_rows:
        supabase.table("records").update({**update_data, "updated_at": now()}).eq("id", record_id).execute()
    return {"record_id": record_id, "medicines_added": len(new_rows), "fields_filled": sorted(update_data)}


def process_added_pages(record_id: str, new_file_entries: list, content_types: list):
    """Merge newly attached pages INTO an existing record.

    This is what keeps a visit to one record: a second photo of the same
    prescription (or another page of a report) is appended here rather than
    becoming a duplicate record. Crucially for retrieval/RAG, the passages and
    embedding are rebuilt once over the full combined text, so 'Ask Your Records'
    never sees two overlapping copies of the same document.
    """
    had_text = False
    try:
        results = read_pages(new_file_entries, content_types)
        new_texts = page_texts(results)
        rec_result = supabase.table("records").select("*").eq("id", record_id).execute()
        if not rec_result.data:
            return
        record = rec_result.data[0]

        existing_text = record.get("raw_ocr_text") or ""
        had_text = bool(existing_text.strip())
        added_text = PAGE_BREAK.join(t for t in new_texts if t.strip())
        combined_text = (
            (existing_text + PAGE_BREAK + added_text).strip()
            if existing_text and added_text else (existing_text or added_text)
        )

        if not combined_text.strip():
            # Nothing on any page could be read. The pages are kept (they are the
            # originals), and the record says so instead of pretending.
            _mark_failed(record_id, SERVICE_DOWN if any_unavailable(results) else UNREADABLE)
            return

        update_data = {"raw_ocr_text": combined_text}

        if added_text.strip():
            data = _extract_or_nothing(added_text)

            # Only FILL fields the record was missing (e.g. the first page was an
            # unreadable handwritten copy and the new one is a clear printout).
            # Never overwrite details the record already has.
            update_data.update(fields_to_fill(record, data))

            # Brand-level matching here: a second copy of the same prescription
            # lists "AZEE" where the first said "AZEE 500MG TABLET".
            rows = medicine_rows(record_id, data.get("medicines"),
                                 existing_medicine_keys(record_id, key=norm_med), key=norm_med)
            if rows:
                supabase.table("medicines").insert(rows).execute()

        supabase.table("records").update(
            {**update_data, "status": "done", **_clear_reason(), "updated_at": now()}
        ).eq("id", record_id).execute()

        meds_now = supabase.table("medicines").select("name").eq("record_id", record_id).execute().data or []
        _refresh_embedding({**record, **update_data}, combined_text, meds_now)
        index_passages(record_id, combined_text)

    except Exception as e:
        logger.error("Attaching pages to record %s failed: %s", record_id, type(e).__name__)
        # Back to what it was before the pages were added: readable if it had
        # text, failed if it never did.
        if had_text:
            supabase.table("records").update(
                {"status": "done", **_clear_reason(), "updated_at": now()}
            ).eq("id", record_id).execute()
        else:
            _mark_failed(record_id, failure_reason(e))
