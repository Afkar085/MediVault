from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field
from app.schemas.record import RecordUpdate, RecordEditResponse
from app.core.dependencies import get_current_user
from app.database import supabase
from app.services import summary_cache
from app.services.record_assembly import (
    attach_files, attach_medicines, attach_related, has_bill_columns, record_columns,
)
from app.services.retrieval import select_context_records, vector_search
from app.services import rag
from app.services.rag import CONTEXT_RECORD_LIMIT, AnswerUnavailable
from app.services.document_files import thumbnail_path
from app.services.storage import BUCKET, forget_signed_urls
from app.limiter import AI_QUESTIONS_PER_DAY, limiter
from app.logger import logger
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from groq import Groq
from app.config import settings

router = APIRouter()


# Columns returned to the client (see record_assembly.record_columns). The
# embedding is a 384-float vector used only for server-side retrieval, and
# raw_ocr_text is the full document text: neither belongs in a list response.
def _list_columns() -> str:
    return record_columns()


def _detail_columns() -> str:
    return record_columns() + ", raw_ocr_text"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AskRequest(BaseModel):
    # Bounded: the question goes into a paid model prompt.
    question: str = Field(min_length=1, max_length=500)


# OCR runs as a background task, so a worker restart, redeploy or hung upstream
# call can leave a record on "processing" with nothing left to finish it. The
# client would then poll forever. Anything that has been processing for longer
# than this is declared failed so the user gets a real error state and something
# to act on (a retry, which reads the original file again).
#
# Measured from updated_at, which every status change stamps, NOT created_at: a
# record uploaded last month that just had a page added, or was retried, started
# processing a second ago. Keying on created_at failed it on the very next poll,
# which is what made the "couldn't be read" warning appear for documents that
# went on to read perfectly well, and stay there until the page was reloaded.
PROCESSING_TIMEOUT = timedelta(minutes=10)
_PENDING_STATUSES = ["processing", "extracting"]

# The client polls the status endpoint every four seconds while a document is
# being read, and this ran a table UPDATE on every one of those, plus on every
# list load: a write per profile per four seconds, to notice something that
# only becomes true after ten minutes. Once a minute per profile sees it just
# as soon and costs a fraction of the database traffic.
SWEEP_INTERVAL_SECONDS = 60
_last_sweep: dict = {}
_sweep_lock = threading.Lock()


def _sweep_is_due(profile_id: str) -> bool:
    now = time.monotonic()
    with _sweep_lock:
        last = _last_sweep.get(profile_id, 0.0)
        if now - last < SWEEP_INTERVAL_SECONDS:
            return False
        # Bounded: one float per profile this worker has served, cleared
        # wholesale rather than tracked individually.
        if len(_last_sweep) > 10_000:
            _last_sweep.clear()
        _last_sweep[profile_id] = now
        return True


def _expire_stuck_processing(profile_id: str, force: bool = False) -> None:
    if not force and not _sweep_is_due(profile_id):
        return
    cutoff = (datetime.now(timezone.utc) - PROCESSING_TIMEOUT).isoformat()
    try:
        result = (
            supabase.table("records")
            .update({"status": "failed", "updated_at": _now()})
            .eq("profile_id", profile_id)
            .in_("status", _PENDING_STATUSES)
            .lt("updated_at", cutoff)
            .execute()
        )
        if result.data:
            logger.warning(
                "Marked %d stuck record(s) as failed for profile %s",
                len(result.data),
                profile_id,
            )
    except Exception as e:
        # Never fail a read because the cleanup could not run.
        logger.warning("Could not expire stuck records for profile %s: %s", profile_id, e)


_MEDICINE_FIELDS = ("dosage", "frequency", "duration")


def _medicine_label(m: dict) -> str:
    detail = " ".join(str(m.get(f)) for f in _MEDICINE_FIELDS if m.get(f))
    return f"{m.get('name')} ({detail})" if detail else str(m.get("name"))


def _replace_medicines(record_id: str, medicines_data: list) -> tuple:
    """Swap a record's medicines for a new set, without a window where it has none.

    There is no transaction available through the REST client, so the delete and
    the insert are separate calls. If the insert failed the delete had already
    committed and the prescription was simply gone, with nothing to recover it.
    We snapshot first and put the old rows back if the new ones do not land.

    An entry that repeats another exactly is dropped: one prescription listing
    the same medicine, dose and schedule twice can only ever be a mistake.
    Returns (before, after) as readable labels for the edit history.
    """
    new_rows = []
    seen = set()
    for medicine in medicines_data:
        name = (medicine.get("name") or "").strip()
        if not name:
            continue
        row = {
            "record_id": record_id,
            "name": name,
            **{field: medicine.get(field) or None for field in _MEDICINE_FIELDS},
        }
        key = (name.lower(),) + tuple(str(row[f] or "").strip().lower() for f in _MEDICINE_FIELDS)
        if key in seen:
            continue
        seen.add(key)
        new_rows.append(row)

    previous = (
        supabase.table("medicines")
        .select("name, dosage, frequency, duration")
        .eq("record_id", record_id)
        .execute()
        .data
        or []
    )
    before = [_medicine_label(m) for m in previous]
    after = [_medicine_label(m) for m in new_rows]

    supabase.table("medicines").delete().eq("record_id", record_id).execute()
    if not new_rows:
        return before, after

    try:
        supabase.table("medicines").insert(new_rows).execute()
    except Exception as e:
        logger.error("Saving medicines failed for record %s: %s", record_id, e)
        if previous:
            try:
                supabase.table("medicines").insert(
                    [{**row, "record_id": record_id} for row in previous]
                ).execute()
                logger.info("Restored %d medicine(s) for record %s", len(previous), record_id)
            except Exception as restore_error:
                logger.error(
                    "Could not restore medicines for record %s: %s", record_id, restore_error
                )
        raise HTTPException(
            status_code=502,
            detail="Could not save the medicines. Nothing was changed. Please try again.",
        ) from e
    return before, after


def _assert_profile_owned(profile_id: str, user_id: str):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")


@router.get("/{profile_id}/records", response_model=None)
def get_records(
    profile_id: str,
    document_category: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user),
):
    _assert_profile_owned(profile_id, user_id)
    _expire_stuck_processing(profile_id)
    query = supabase.table("records").select(_list_columns()).eq("profile_id", profile_id).order("created_at", desc=True)
    if document_category:
        query = query.eq("document_category", document_category)
    result = query.execute()
    return attach_related(result.data)


@router.get("/{profile_id}/records/status", response_model=None)
def get_record_statuses(profile_id: str, user_id: str = Depends(get_current_user)):
    """Only id, status and updated_at for each of this member's records.

    This is what the client polls while a document is being read. The full list
    costs three queries plus signing every page's URL; this is one narrow query,
    and the client fetches the full list only when something actually changed.
    """
    _assert_profile_owned(profile_id, user_id)
    _expire_stuck_processing(profile_id)
    rows = supabase.table("records").select("id, status, updated_at").eq("profile_id", profile_id).execute()
    return rows.data or []


@router.get("/{profile_id}/records/{record_id}", response_model=None)
def get_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    result = supabase.table("records").select(_detail_columns()).eq("id", record_id).eq("profile_id", profile_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    return attach_related(result.data)[0]


_BILL_DETAIL_FIELDS = ("bill_category", "bill_title", "bill_number")


@router.put("/{profile_id}/records/{record_id}", response_model=None)
def update_record(profile_id: str, record_id: str, body: RecordUpdate, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    existing_result = supabase.table("records").select(_detail_columns()).eq("id", record_id).eq("profile_id", profile_id).execute()
    if not existing_result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    existing = existing_result.data[0]

    data = body.model_dump(exclude_none=True)
    medicines_data = data.pop("medicines", None)

    # The bill detail columns come with migration 005. Until it is applied they
    # cannot be stored, and the client is told so instead of being shown
    # "Updated" for a value that silently vanished.
    unsaved_fields = []
    if not has_bill_columns():
        for field in _BILL_DETAIL_FIELDS:
            if data.pop(field, None) is not None:
                unsaved_fields.append(field)

    if "document_date" in data and data["document_date"]:
        data["document_date"] = str(data["document_date"])

    # Only what actually changes is written, and recorded.
    data = {f: v for f, v in data.items() if str(existing.get(f)) != str(v)}
    edits = [
        {
            "record_id": record_id,
            "field_name": field,
            "old_value": str(existing.get(field)) if existing.get(field) is not None else None,
            "new_value": str(new_val),
        }
        for field, new_val in data.items()
    ]

    if data:
        result = (
            supabase.table("records").update({**data, "updated_at": _now()})
            .eq("id", record_id).eq("profile_id", profile_id).execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Record not found")

    if medicines_data is not None:
        before, after = _replace_medicines(record_id, medicines_data)
        if before != after:
            edits.append({
                "record_id": record_id,
                "field_name": "medicines",
                "old_value": "; ".join(before) or None,
                "new_value": "; ".join(after) or "none",
            })
            if not data:
                supabase.table("records").update({"updated_at": _now()}).eq("id", record_id).execute()

    # History is written after the change it describes has landed, so it can
    # never claim an edit that failed. Losing a history row must not undo a save.
    if edits:
        try:
            supabase.table("record_edits").insert(edits).execute()
        except Exception as e:
            logger.warning("Could not record edit history for %s: %s", record_id, e)

    result = supabase.table("records").select(_detail_columns()).eq("id", record_id).eq("profile_id", profile_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    record = attach_related(result.data)[0]
    if unsaved_fields:
        record["unsaved_fields"] = unsaved_fields
    return record


@router.delete("/{profile_id}/records/{record_id}")
def delete_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    files_result = supabase.table("record_files").select("file_path").eq("record_id", record_id).execute()
    record_result = supabase.table("records").select("file_path").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not record_result.data:
        raise HTTPException(status_code=404, detail="Record not found")

    paths_to_delete = []
    main_path = record_result.data[0].get("file_path")
    if main_path:
        paths_to_delete.append(main_path)
    for f in files_result.data:
        p = f.get("file_path")
        if p and p not in paths_to_delete:
            paths_to_delete.append(p)

    # The row goes first; its medicines, pages, passages and history cascade with
    # it in one statement. Removing the files first meant that a failed row
    # delete left a record whose documents were already gone.
    supabase.table("records").delete().eq("id", record_id).eq("profile_id", profile_id).execute()

    # Verify the row is actually gone. A delete that silently affects zero rows
    # (e.g. an RLS/permission edge case that returns 200 without deleting) must
    # surface as an error here — otherwise the UI shows a false "deleted" and the
    # record reappears on the next refresh, which is exactly the kind of silent
    # failure that makes delete look broken.
    check = (
        supabase.table("records")
        .select("id")
        .eq("id", record_id)
        .eq("profile_id", profile_id)
        .execute()
    )
    if check.data:
        raise HTTPException(status_code=500, detail="The record could not be deleted. Please try again.")

    # Only now are the files removed. One that another record still points to
    # is kept.
    still_used = set()
    if paths_to_delete:
        try:
            shared = supabase.table("record_files").select("file_path").in_("file_path", paths_to_delete).execute()
            still_used = {f["file_path"] for f in (shared.data or [])}
        except Exception:
            still_used = set(paths_to_delete)  # unsure: keep them rather than break another record
    orphaned = [p for p in paths_to_delete if p not in still_used]
    # Each page's small copy is derived data and goes with the page itself.
    orphaned += [thumbnail_path(p) for p in orphaned]
    forget_signed_urls(orphaned)
    if orphaned:
        try:
            supabase.storage.from_(BUCKET).remove(orphaned)
        except Exception as e:
            # The record is deleted either way; a leftover private file is
            # unreachable from the app and only costs storage.
            logger.warning("Record %s deleted but %d file(s) were not removed: %s", record_id, len(orphaned), e)

    return {"message": "Record deleted"}


@router.put("/{profile_id}/records/{record_id}/insurance")
def toggle_insurance(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    existing = supabase.table("records").select("insurance_claimed").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Record not found")
    current = existing.data[0].get("insurance_claimed", False)
    result = (
        supabase.table("records").update({"insurance_claimed": not current, "updated_at": _now()})
        .eq("id", record_id).eq("profile_id", profile_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    return result.data[0]


@router.get("/{profile_id}/bills")
def get_bills(profile_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    result = (
        supabase.table("records")
        .select(_list_columns())
        .eq("profile_id", profile_id)
        .eq("document_category", "bill")
        .order("document_date", desc=True)
        .execute()
    )
    records = attach_files(result.data)

    months = {}
    total_spent = 0
    total_claimed = 0
    for r in records:
        amt = float(r.get("bill_amount") or 0)
        total_spent += amt
        if r.get("insurance_claimed"):
            total_claimed += amt

        date_str = r.get("document_date") or (r.get("created_at") or "")[:10]
        month_key = date_str[:7] if date_str else "Unknown"
        if month_key not in months:
            months[month_key] = {"month": month_key, "total": 0, "bills": []}
        months[month_key]["total"] += amt
        months[month_key]["bills"].append(r)

    return {
        "summary": {
            "total_spent": total_spent,
            "total_claimed": total_claimed,
            "unclaimed": total_spent - total_claimed,
        },
        "months": list(months.values()),
    }


# Both of these call the LLM on every request.
@router.get("/{profile_id}/health-journey")
@limiter.limit("10/minute")
@limiter.limit(AI_QUESTIONS_PER_DAY)
def get_health_journey(request: Request, profile_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    profile_result = supabase.table("profiles").select("name, relationship").eq("id", profile_id).execute()
    profile = profile_result.data[0] if profile_result.data else {"name": "Patient", "relationship": "Self"}

    records_result = supabase.table("records").select(_list_columns()).eq("profile_id", profile_id).eq("status", "done").order("created_at", desc=False).execute()
    records = attach_medicines(records_result.data)

    if not records:
        return {"summary": "", "total_visits": 0}

    visits = []
    for r in records:
        date = r.get("document_date") or (r.get("created_at") or "")[:10]
        meds = ", ".join(m.get("name", "") for m in r.get("medicines", []))
        entry = f"Date: {date}"
        if r.get("doctor_name"):
            entry += f" | Doctor: {r['doctor_name']}"
        if r.get("specialty"):
            entry += f" | Dept: {r['specialty']}"
        if r.get("hospital_name"):
            entry += f" | Hospital: {r['hospital_name']}"
        if r.get("diagnosis"):
            entry += f" | Diagnosis: {r['diagnosis']}"
        if meds:
            entry += f" | Medicines: {meds}"
        if r.get("recommendations"):
            entry += f" | Notes: {r['recommendations']}"
        visits.append(entry)

    visit_text = "\n".join(visits)

    # The summary is a pure function of these records, so regenerating it on
    # every visit spends seconds and tokens producing an answer we already had.
    records_fingerprint = summary_cache.fingerprint(records)
    cached = summary_cache.get(profile_id, records_fingerprint)
    if cached:
        return {"summary": cached, "total_visits": len(records), "cached": True}

    summary = ""
    try:
        client = Groq(api_key=settings.GROQ_API_KEY, timeout=60.0, max_retries=1)
        response = client.chat.completions.create(
            model=settings.GROQ_TEXT_MODEL,
            messages=[{
                "role": "user",
                "content": f"""Summarize this patient's health journey as a concise timeline narrative.
Patient: {profile.get('name')} ({profile.get('relationship')})

Medical visits:
{visit_text}

Write 3-8 bullet points summarizing the health journey chronologically.
Focus on: key diagnoses, treatment progression, medication changes, follow-up outcomes.
Use simple language a patient would understand.
Use only what is in the visits above; do not add anything that is not written there.
Use ordinary punctuation. Never use an em dash; use a comma, a full stop or brackets instead.
Format each point starting with the month/year, then the event.
Return ONLY the bullet points, no intro or outro."""
            }],
            temperature=0.3,
            # Headroom for reasoning-model tokens (gpt-oss-120b) so the actual
            # bullet-point summary isn't truncated by internal reasoning.
            max_tokens=2000,
        )
        summary = (response.choices[0].message.content or "").strip()
        if summary:
            summary_cache.put(profile_id, records_fingerprint, summary)
        else:
            logger.warning("Health journey generation returned empty content for profile %s", profile_id)
    except Exception as e:
        logger.error("Health journey generation failed for profile %s: %s", profile_id, e)

    if not summary:
        # A failure is an error, not a summary: returned as text it was shown as
        # a bullet point about the patient. Deliberately not cached.
        raise HTTPException(status_code=503, detail="The summary couldn't be written just now. Please try again.")
    return {"summary": summary, "total_visits": len(records)}


@router.post("/{profile_id}/ask")
@limiter.limit("15/minute")
@limiter.limit(AI_QUESTIONS_PER_DAY)
def ask_records(request: Request, profile_id: str, body: AskRequest, user_id: str = Depends(get_current_user)):
    """Answer a question about this profile's records, grounded in them (RAG).

    Retrieval is semantic when the embedding model is available, and term-based
    otherwise. The old fallback was "the six most recent records", which quietly
    answered a question about last year from last week's documents.
    """
    _assert_profile_owned(profile_id, user_id)

    question = (body.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty")

    profile_result = supabase.table("profiles").select("name, relationship").eq("id", profile_id).execute()
    profile = profile_result.data[0] if profile_result.data else {"name": "Patient", "relationship": "Self"}

    matched_ids = vector_search([profile_id], question, limit=CONTEXT_RECORD_LIMIT)

    if matched_ids:
        rows = (
            supabase.table("records")
            .select(_detail_columns())
            .eq("profile_id", profile_id)
            .eq("status", "done")
            .in_("id", matched_ids)
            .execute()
        )
        by_id = {r["id"]: r for r in rows.data}
        records = [by_id[i] for i in matched_ids if i in by_id]  # preserve relevance order
    else:
        rows = (
            supabase.table("records")
            .select(_detail_columns())
            .eq("profile_id", profile_id)
            .eq("status", "done")
            .order("created_at", desc=True)
            .execute()
        )
        candidates = attach_medicines(rows.data)
        records = select_context_records(candidates, question, limit=CONTEXT_RECORD_LIMIT)

    records = attach_medicines(records)
    try:
        return rag.answer_question(question, records, profile)
    except AnswerUnavailable as e:
        # A technical failure is not an answer. Returning "Sorry" with a 200 made
        # it look as if the records had been read and found wanting.
        raise HTTPException(status_code=503, detail="Couldn't get an answer right now. Please try again.") from e


@router.get("/{profile_id}/records/{record_id}/history", response_model=List[RecordEditResponse])
def get_record_history(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    record_result = supabase.table("records").select("id").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not record_result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    result = supabase.table("record_edits").select("*").eq("record_id", record_id).order("edited_at", desc=True).execute()
    return result.data
