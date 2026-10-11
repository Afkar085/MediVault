from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, BackgroundTasks
from app.core.dependencies import get_current_user
from app.database import supabase
from app.services.chunking import chunk_document
from app.services.ocr import extract_text_from_bytes
from app.services.storage import BUCKET, signed_url
from app.limiter import limiter
from app.logger import logger
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import hashlib
import re

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/jpg", "image/webp",
    "image/gif", "image/bmp", "application/pdf"
}
MAX_SIZE = 10 * 1024 * 1024

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

UPLOAD_CATEGORIES = {"prescription", "lab_report", "bill", "discharge_summary", "other"}

# Fields the extractor may fill in. It only ever fills a field that is still
# empty: anything the person typed at upload time, or edited since, wins.
_EXTRACTED_FIELDS = ("document_type", "doctor_name", "hospital_name", "document_date",
                     "specialty", "diagnosis", "recommendations", "document_category")

PAGE_BREAK = "\n\n--- Page Break ---\n\n"


def _now() -> str:
    """A timestamp for updated_at, which is also the clock the stuck-job timeout reads."""
    return datetime.now(timezone.utc).isoformat()


def _content_matches_type(contents: bytes, content_type: str) -> bool:
    check = _MAGIC_CHECKS.get(content_type)
    return check(contents) if check else False


def _content_type_for_path(file_path: str) -> str:
    return _TYPE_BY_EXTENSION.get(file_path.rsplit(".", 1)[-1].lower(), "")


def _slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def _norm_med(name: str) -> str:
    """Normalise a medicine name to its brand token, so 'AZEE' and 'AZEE 500MG
    TABLET' collapse to the same key when de-duplicating across merged pages."""
    return re.sub(r'[^a-z0-9]+', ' ', (name or '').lower()).strip().split(' ')[0]


def _med_key(name: str) -> str:
    """The whole normalised name. Used within one document, where 'AZEE 250' and
    'AZEE 500' on the same prescription are two different instructions."""
    return re.sub(r'[^a-z0-9]+', ' ', (name or '').lower()).strip()


def _blank(record: dict, field: str) -> bool:
    value = record.get(field)
    if field == "document_type":
        return not value or value == "Unknown"
    return value is None or value == ""


def _compute_visit_group(profile_id: str, doctor_name: str, doc_date_str: str) -> str:
    if not doctor_name:
        return None
    slug = _slugify(doctor_name)
    if doc_date_str:
        try:
            doc_date = datetime.strptime(doc_date_str, "%Y-%m-%d").date()
        except ValueError:
            doc_date = datetime.utcnow().date()
    else:
        doc_date = datetime.utcnow().date()

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


# Each page is an independent network round-trip plus a vision call, so reading
# them one after another made a five-page upload take five times as long as it
# needed to. Bounded, because the vision API is rate limited and one upload must
# not be able to exhaust that for everyone.
MAX_CONCURRENT_PAGES = 4


def _read_page(entry: dict, content_type: str) -> str:
    """OCR one page. Never raises: a page that fails must not lose the others."""
    try:
        file_bytes = supabase.storage.from_(BUCKET).download(entry["file_path"])
        return extract_text_from_bytes(file_bytes, content_type)
    except Exception as e:
        logger.warning("Could not read page %s: %s", entry.get("file_path"), e)
        return ""


def read_pages(file_entries: list, content_types: list) -> list:
    """OCR every page, concurrently, in page order."""
    pairs = [
        (entry, content_types[i] if i < len(content_types) else "")
        for i, entry in enumerate(file_entries)
    ]
    if len(pairs) <= 1:
        return [_read_page(entry, ct) for entry, ct in pairs]

    with ThreadPoolExecutor(max_workers=min(MAX_CONCURRENT_PAGES, len(pairs))) as pool:
        # map preserves input order, which is the page order.
        return list(pool.map(lambda pair: _read_page(*pair), pairs))


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


def _medicine_rows(record_id: str, medicines: list, existing_keys: set, key=_med_key) -> list:
    """New medicine rows, skipping any already on the record or repeated in the list.

    Running extraction again (a retry, a re-read) must never stack a second copy
    of the same prescription on the record, and models do sometimes list one line
    twice.
    """
    seen = set(existing_keys)
    rows = []
    for m in medicines or []:
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


def _existing_medicine_keys(record_id: str, key=_med_key) -> set:
    rows = supabase.table("medicines").select("name").eq("record_id", record_id).execute().data or []
    return {key(m.get("name")) for m in rows}


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


def process_ocr(record_id: str, file_entries: list, content_types: list):
    """Read a record's pages and fill in what the documents say.

    Safe to run more than once on the same record (that is what a retry does):
    it only fills empty fields, and never adds a medicine the record already has.
    """
    try:
        all_texts = read_pages(file_entries, content_types)
        if not any(t.strip() for t in all_texts):
            raise RuntimeError("no text could be read from any page")

        combined_text = PAGE_BREAK.join(t for t in all_texts if t.strip())

        supabase.table("records").update({
            "raw_ocr_text": combined_text,
            "status": "extracting",
            "updated_at": _now(),
        }).eq("id", record_id).execute()

        from app.services.ai_extractor import extract_medical_data
        data = extract_medical_data(combined_text)

        current = supabase.table("records").select(
            "id, profile_id, visit_group, bill_amount, " + ", ".join(_EXTRACTED_FIELDS)
        ).eq("id", record_id).execute().data
        if not current:
            logger.info("Record %s was deleted while it was being read", record_id)
            return
        record = current[0]

        update_data = {}
        for field in _EXTRACTED_FIELDS:
            if data.get(field) and _blank(record, field):
                update_data[field] = data[field]

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

        rows = _medicine_rows(record_id, data.get("medicines"), _existing_medicine_keys(record_id))
        if rows:
            supabase.table("medicines").insert(rows).execute()

        # "done" is written last, so the record never claims to be finished
        # while its medicines are still missing.
        supabase.table("records").update(
            {**update_data, "status": "done", "updated_at": _now()}
        ).eq("id", record_id).execute()

        _refresh_embedding({**merged, **update_data}, combined_text, data.get("medicines") or [])
        index_passages(record_id, combined_text)

    except Exception as e:
        # The reason is logged; the document text is not (it is medical data).
        logger.error("OCR/extraction pipeline failed for record %s: %s", record_id, type(e).__name__ + ": " + str(e)[:200])
        # Only the status changes: if OCR succeeded and extraction failed, the
        # text we did get is still worth keeping. The original file is untouched.
        supabase.table("records").update({"status": "failed", "updated_at": _now()}).eq("id", record_id).execute()


async def _validate_uploads(files) -> list:
    """Check every file before anything is stored, so a bad third file cannot
    leave the first two orphaned in the bucket."""
    checked = []
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP, GIF, BMP, PDF"
            )
        contents = await file.read()
        if len(contents) > MAX_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max 10MB per file")
        if not contents:
            raise HTTPException(status_code=400, detail="That file is empty.")
        if not _content_matches_type(contents, file.content_type):
            raise HTTPException(status_code=400, detail="File content does not match its declared type")
        checked.append((contents, file.content_type))
    return checked


def _content_path(user_id: str, profile_id: str, contents: bytes, content_type: str) -> str:
    """Where a document lives: derived from its bytes, not a random id.

    The same photo uploaded twice for the same member lands on the same key, so
    a retried request (a timeout, a double tap, a flaky connection) is
    recognisable as the document we already have instead of becoming a second
    record. Scoped by user and member, so it never links two people's files.
    """
    digest = hashlib.sha256(contents).hexdigest()
    return f"{user_id}/{profile_id}/{digest}.{_EXTENSION_BY_TYPE[content_type]}"


def _records_holding(paths: list, profile_id: str) -> dict:
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


def _store(entries: list) -> None:
    for entry in entries:
        # upsert: the key is the content hash, so overwriting can only ever
        # write the same bytes. It makes a replayed request harmless.
        supabase.storage.from_(BUCKET).upload(
            path=entry["file_path"],
            file=entry["contents"],
            file_options={"content-type": entry["content_type"], "upsert": "true"},
        )


def _discard(paths: list) -> None:
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


def _parse_upload_fields(document_category, document_date, doctor_name) -> dict:
    """Details the person gave when uploading. Validated like an edit would be."""
    fields = {}
    if document_category:
        if document_category not in UPLOAD_CATEGORIES:
            raise HTTPException(status_code=400, detail="Unknown document type.")
        fields["document_category"] = document_category
    if document_date:
        try:
            parsed = date.fromisoformat(document_date)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="The date must look like 2026-09-20.") from e
        if parsed > date.today() + timedelta(days=1):
            raise HTTPException(status_code=400, detail="The date on a document can't be in the future.")
        fields["document_date"] = parsed.isoformat()
    name = (doctor_name or "").strip()
    if name:
        if len(name) > 200:
            raise HTTPException(status_code=400, detail="The doctor's name is too long.")
        fields["doctor_name"] = name
    return fields


def _assert_profile(profile_id: str, user_id: str) -> None:
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")


# Each page costs a vision-model call plus an extraction call, so an unbounded
# upload loop drains the Groq quota for every user of the deployment.
@router.post("/upload/{profile_id}")
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    profile_id: str,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    document_category: Optional[str] = Form(None),
    document_date: Optional[str] = Form(None),
    doctor_name: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user),
):
    _assert_profile(profile_id, user_id)
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one file.")
    user_fields = _parse_upload_fields(document_category, document_date, doctor_name)

    entries = []
    for contents, content_type in await _validate_uploads(files):
        path = _content_path(user_id, profile_id, contents, content_type)
        if any(e["file_path"] == path for e in entries):
            continue  # the same page picked twice in one upload
        entries.append({"file_path": path, "contents": contents, "content_type": content_type})
    paths = [e["file_path"] for e in entries]

    # Idempotency: these exact documents are already a record of this member.
    held = _records_holding(paths, profile_id)
    if held:
        record_ids = set(held.values())
        if len(held) == len(paths) and len(record_ids) == 1:
            record_id = record_ids.pop()
            existing = supabase.table("records").select("id, status").eq("id", record_id).execute().data
            return {
                "message": "This document is already saved.",
                "record_id": record_id,
                "status": existing[0]["status"] if existing else None,
                "duplicate": True,
                "pages": len(paths),
            }
        raise HTTPException(
            status_code=409,
            detail="Some of these pages are already saved in another record. Remove them and try again.",
        )

    _store(entries)

    try:
        result = supabase.table("records").insert({
            "profile_id": profile_id,
            "document_type": "Unknown",
            "status": "processing",
            "file_path": paths[0],
            "updated_at": _now(),
            **user_fields,
        }).execute()
        record_id = result.data[0]["id"]
    except Exception as e:
        logger.error("Could not create a record for an upload: %s", e)
        _discard(paths)
        raise HTTPException(status_code=502, detail="The document could not be saved. Nothing was stored. Please try again.") from e

    try:
        supabase.table("record_files").insert([
            {
                "record_id": record_id,
                # Kept empty (the column is NOT NULL until migration 003 runs) so no
                # long-lived public URL is ever stored; readers get a signed URL.
                "file_url": "",
                "file_path": entry["file_path"],
                "page_number": i + 1,
            }
            for i, entry in enumerate(entries)
        ]).execute()
    except Exception as e:
        # Without its pages the record would be an empty shell: undo it whole.
        supabase.table("records").delete().eq("id", record_id).execute()
        # Lost a race with an identical upload (two taps, two tabs)? The unique
        # index on record_files.file_path (migration 005) rejected our copy, and
        # the other request's record is the one to return.
        winner = _records_holding(paths, profile_id)
        if winner and len(set(winner.values())) == 1 and len(winner) == len(paths):
            existing_id = next(iter(winner.values()))
            status = supabase.table("records").select("status").eq("id", existing_id).execute().data
            return {
                "message": "This document is already saved.",
                "record_id": existing_id,
                "status": status[0]["status"] if status else None,
                "duplicate": True,
                "pages": len(paths),
            }
        logger.error("Could not attach pages to record %s: %s", record_id, e)
        _discard(paths)
        raise HTTPException(status_code=502, detail="The document could not be saved. Nothing was stored. Please try again.") from e

    background_tasks.add_task(process_ocr, record_id, [{"file_path": p} for p in paths],
                              [e["content_type"] for e in entries])

    return {
        "message": "File(s) uploaded. OCR processing in background.",
        "record_id": record_id,
        "status": "processing",
        "duplicate": False,
        "file_path": paths[0],
        "file_url": signed_url(paths[0]),
        "pages": len(paths),
    }


def _record_pages(record: dict) -> list:
    """A record's pages in order, including legacy records that only have file_path."""
    files = (
        supabase.table("record_files").select("file_path, page_number")
        .eq("record_id", record["id"]).order("page_number").execute().data or []
    )
    paths = [f["file_path"] for f in files if f.get("file_path")]
    if not paths and record.get("file_path"):
        paths = [record["file_path"]]
    return paths


@router.post("/profiles/{profile_id}/records/{record_id}/retry")
@limiter.limit("10/minute")
def retry_record(
    request: Request,
    profile_id: str,
    record_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """Read a document that failed, again, from the original file.

    Claimed with a conditional update (only a *failed* record flips to
    processing), so two taps, two tabs or a replayed request start exactly one
    job, and a record that is already being read is left alone.
    """
    _assert_profile(profile_id, user_id)
    rows = supabase.table("records").select("id, status, file_path").eq("id", record_id).eq(
        "profile_id", profile_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Record not found")
    record = rows[0]

    paths = _record_pages(record)
    if not paths:
        raise HTTPException(status_code=409, detail="This record has no document to read. Upload it again.")

    claimed = (
        supabase.table("records").update({"status": "processing", "updated_at": _now()})
        .eq("id", record_id).eq("profile_id", profile_id).eq("status", "failed").execute().data
    )
    if not claimed:
        status = supabase.table("records").select("status").eq("id", record_id).execute().data
        current = status[0]["status"] if status else None
        if current in ("processing", "extracting"):
            return {"record_id": record_id, "status": current, "started": False}
        raise HTTPException(status_code=409, detail="This document has already been read.")

    background_tasks.add_task(process_ocr, record_id, [{"file_path": p} for p in paths],
                              [_content_type_for_path(p) for p in paths])
    return {"record_id": record_id, "status": "processing", "started": True}


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
        new_texts = read_pages(new_file_entries, content_types)
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
            supabase.table("records").update({"status": "failed", "updated_at": _now()}).eq("id", record_id).execute()
            return

        update_data = {"raw_ocr_text": combined_text}

        if added_text.strip():
            from app.services.ai_extractor import extract_medical_data
            data = extract_medical_data(added_text)

            # Only FILL fields the record was missing (e.g. the first page was an
            # unreadable handwritten copy and the new one is a clear printout).
            # Never overwrite details the record already has.
            for field in _EXTRACTED_FIELDS:
                if data.get(field) and _blank(record, field):
                    update_data[field] = data[field]

            # Brand-level matching here: a second copy of the same prescription
            # lists "AZEE" where the first said "AZEE 500MG TABLET".
            rows = _medicine_rows(record_id, data.get("medicines"),
                                  _existing_medicine_keys(record_id, key=_norm_med), key=_norm_med)
            if rows:
                supabase.table("medicines").insert(rows).execute()

        supabase.table("records").update(
            {**update_data, "status": "done", "updated_at": _now()}
        ).eq("id", record_id).execute()

        meds_now = supabase.table("medicines").select("name").eq("record_id", record_id).execute().data or []
        _refresh_embedding({**record, **update_data}, combined_text, meds_now)
        index_passages(record_id, combined_text)

    except Exception as e:
        logger.error("Attaching pages to record %s failed: %s", record_id, type(e).__name__)
        # Back to what it was before the pages were added: readable if it had
        # text, failed if it never did.
        supabase.table("records").update(
            {"status": "done" if had_text else "failed", "updated_at": _now()}
        ).eq("id", record_id).execute()


@router.post("/profiles/{profile_id}/records/{record_id}/pages")
@limiter.limit("20/minute")
async def add_pages(
    request: Request,
    profile_id: str,
    record_id: str,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    user_id: str = Depends(get_current_user),
):
    """Attach one or more documents to an EXISTING record as extra pages, instead
    of creating a new record for the same visit. Used by the visit screen's
    '+ Add Prescription / Lab Report' buttons so related documents stay a single
    record (one entry, one carousel, one clean copy of the content for search)."""
    _assert_profile(profile_id, user_id)

    record = supabase.table("records").select("id, status").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not record.data:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.data[0].get("status") in ("processing", "extracting"):
        raise HTTPException(status_code=409, detail="This record is still being read. Try again in a moment.")

    entries = []
    for contents, content_type in await _validate_uploads(files):
        path = _content_path(user_id, profile_id, contents, content_type)
        if any(e["file_path"] == path for e in entries):
            continue
        entries.append({"file_path": path, "contents": contents, "content_type": content_type})

    # A page this member already has, on this record or another, is not added again.
    held = _records_holding([e["file_path"] for e in entries], profile_id)
    fresh = [e for e in entries if e["file_path"] not in held]
    if not fresh:
        return {"message": "These pages are already saved.", "record_id": record_id,
                "pages_added": 0, "duplicate": True}

    _store(fresh)

    # Continue page numbering after whatever the record already has.
    existing_files = supabase.table("record_files").select("page_number").eq("record_id", record_id).execute().data or []
    start = max((f.get("page_number") or 0) for f in existing_files) if existing_files else 0
    rows = [
        {"record_id": record_id, "file_url": "", "file_path": e["file_path"], "page_number": start + i + 1}
        for i, e in enumerate(fresh)
    ]
    try:
        supabase.table("record_files").insert(rows).execute()
    except Exception as e:
        logger.error("Could not attach pages to record %s: %s", record_id, e)
        _discard([entry["file_path"] for entry in fresh])
        raise HTTPException(status_code=502, detail="The pages could not be added. Nothing was changed. Please try again.") from e

    supabase.table("records").update({"status": "processing", "updated_at": _now()}).eq("id", record_id).execute()
    background_tasks.add_task(process_added_pages, record_id, [{"file_path": e["file_path"]} for e in fresh],
                              [e["content_type"] for e in fresh])

    return {
        "message": "Pages added. Reading them now.",
        "record_id": record_id,
        "pages_added": len(fresh),
        "duplicate": False,
    }
