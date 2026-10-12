"""Uploading documents, and asking for them to be read (again).

The HTTP layer only: ownership checks, request validation and responses. What
happens to the files is in services.document_files; reading them and filling in
the record is in services.record_pipeline, which runs as a background task.
"""
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile

from app.core.dependencies import get_current_user
from app.database import supabase
from app.limiter import AI_REREADS_PER_DAY, AI_UPLOADS_PER_DAY, limiter
from app.logger import logger
from app.services import document_files as files_svc
from app.services.document_files import UploadRejected
from app.services.record_pipeline import (
    EXTRACTED_FIELDS, now, process_added_pages, process_ocr, reextract,
)
from app.services.storage import signed_url

router = APIRouter()

UPLOAD_CATEGORIES = {"prescription", "lab_report", "bill", "discharge_summary", "other"}

_NOT_SAVED = "The document could not be saved. Nothing was stored. Please try again."


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


async def _entries(files, user_id: str, profile_id: str) -> list:
    try:
        return await files_svc.prepare_entries(files, user_id, profile_id)
    except UploadRejected as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _already_saved(record_id: str, pages: int) -> dict:
    status = supabase.table("records").select("status").eq("id", record_id).execute().data
    return {
        "message": "This document is already saved.",
        "record_id": record_id,
        "status": status[0]["status"] if status else None,
        "duplicate": True,
        "pages": pages,
    }


def _single_record_holding_all(held: dict, paths: list):
    """The record id if every path belongs to one and the same record, else None."""
    ids = set(held.values())
    return next(iter(ids)) if len(held) == len(paths) and len(ids) == 1 else None


# Each page costs a vision-model call plus an extraction call, so an unbounded
# upload loop drains the Groq quota for every user of the deployment.
@router.post("/upload/{profile_id}")
@limiter.limit("20/minute")
@limiter.limit(AI_UPLOADS_PER_DAY)
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

    entries = await _entries(files, user_id, profile_id)
    paths = [e["file_path"] for e in entries]

    # Idempotency: these exact documents are already a record of this member.
    held = files_svc.records_holding(paths, profile_id)
    if held:
        existing_id = _single_record_holding_all(held, paths)
        if existing_id:
            return _already_saved(existing_id, len(paths))
        raise HTTPException(
            status_code=409,
            detail="Some of these pages are already saved in another record. Remove them and try again.",
        )

    files_svc.store(entries)

    try:
        result = supabase.table("records").insert({
            "profile_id": profile_id,
            "document_type": "Unknown",
            "status": "processing",
            "file_path": paths[0],
            "updated_at": now(),
            **user_fields,
        }).execute()
        record_id = result.data[0]["id"]
    except Exception as e:
        logger.error("Could not create a record for an upload: %s", e)
        files_svc.discard(paths)
        raise HTTPException(status_code=502, detail=_NOT_SAVED) from e

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
        winner = _single_record_holding_all(files_svc.records_holding(paths, profile_id), paths)
        if winner:
            return _already_saved(winner, len(paths))
        logger.error("Could not attach pages to record %s: %s", record_id, e)
        files_svc.discard(paths)
        raise HTTPException(status_code=502, detail=_NOT_SAVED) from e

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


@router.post("/profiles/{profile_id}/records/{record_id}/retry")
@limiter.limit("10/minute")
@limiter.limit(AI_REREADS_PER_DAY)
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

    paths = files_svc.record_pages(rows[0])
    if not paths:
        raise HTTPException(status_code=409, detail="This record has no document to read. Upload it again.")

    claimed = (
        supabase.table("records").update({"status": "processing", "updated_at": now()})
        .eq("id", record_id).eq("profile_id", profile_id).eq("status", "failed").execute().data
    )
    if not claimed:
        status = supabase.table("records").select("status").eq("id", record_id).execute().data
        current = status[0]["status"] if status else None
        if current in ("processing", "extracting"):
            return {"record_id": record_id, "status": current, "started": False}
        raise HTTPException(status_code=409, detail="This document has already been read.")

    background_tasks.add_task(process_ocr, record_id, [{"file_path": p} for p in paths],
                              [files_svc.content_type_for_path(p) for p in paths])
    return {"record_id": record_id, "status": "processing", "started": True}


@router.post("/profiles/{profile_id}/records/{record_id}/reextract")
@limiter.limit("10/minute")
@limiter.limit(AI_REREADS_PER_DAY)
def reextract_record(request: Request, profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    """Read the details again from the text already scanned. No new OCR.

    For a record whose medicines (or other details) were missed although the
    scanned text shows them. Running it twice changes nothing.
    """
    _assert_profile(profile_id, user_id)
    rows = supabase.table("records").select(
        "id, status, raw_ocr_text, bill_amount, " + ", ".join(EXTRACTED_FIELDS)
    ).eq("id", record_id).eq("profile_id", profile_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Record not found")
    record = rows[0]
    if record.get("status") != "done" or not (record.get("raw_ocr_text") or "").strip():
        raise HTTPException(status_code=409, detail="There is no scanned text to read yet.")

    try:
        return reextract(record)
    except Exception as e:
        logger.error("Re-extraction failed for record %s: %s", record_id, type(e).__name__)
        raise HTTPException(status_code=503, detail="Couldn't read the details right now. Please try again.") from e


@router.post("/profiles/{profile_id}/records/{record_id}/pages")
@limiter.limit("20/minute")
@limiter.limit(AI_UPLOADS_PER_DAY)
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

    entries = await _entries(files, user_id, profile_id)

    # A page this member already has, on this record or another, is not added again.
    held = files_svc.records_holding([e["file_path"] for e in entries], profile_id)
    fresh = [e for e in entries if e["file_path"] not in held]
    if not fresh:
        return {"message": "These pages are already saved.", "record_id": record_id,
                "pages_added": 0, "duplicate": True}

    files_svc.store(fresh)

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
        files_svc.discard([entry["file_path"] for entry in fresh])
        raise HTTPException(status_code=502, detail="The pages could not be added. Nothing was changed. Please try again.") from e

    supabase.table("records").update({"status": "processing", "updated_at": now()}).eq("id", record_id).execute()
    background_tasks.add_task(process_added_pages, record_id, [{"file_path": e["file_path"]} for e in fresh],
                              [e["content_type"] for e in fresh])

    return {
        "message": "Pages added. Reading them now.",
        "record_id": record_id,
        "pages_added": len(fresh),
        "duplicate": False,
    }
