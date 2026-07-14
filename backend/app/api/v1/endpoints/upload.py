from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from app.core.dependencies import get_current_user
from app.database import supabase
from app.services.ocr import extract_text_from_bytes
from app.services.storage import signed_url
from app.logger import logger
from typing import List
from datetime import datetime, timedelta
import uuid
import re

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/jpg", "image/webp",
    "image/gif", "image/bmp", "application/pdf"
}
MAX_SIZE = 10 * 1024 * 1024

# Magic-byte signatures — the client-supplied content_type header can be spoofed,
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


def _content_matches_type(contents: bytes, content_type: str) -> bool:
    check = _MAGIC_CHECKS.get(content_type)
    return check(contents) if check else False


def _slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


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


def process_ocr(record_id: str, file_entries: list, content_types: list):
    try:
        all_texts = []
        for i, entry in enumerate(file_entries):
            file_path = entry["file_path"]
            ct = content_types[i] if i < len(content_types) else ""
            file_bytes = supabase.storage.from_("medical-records").download(file_path)
            text = extract_text_from_bytes(file_bytes, ct)
            all_texts.append(text)

        combined_text = "\n\n--- Page Break ---\n\n".join(all_texts)

        supabase.table("records").update({
            "raw_ocr_text": combined_text,
            "status": "extracting"
        }).eq("id", record_id).execute()

        from app.services.ai_extractor import extract_medical_data
        data = extract_medical_data(combined_text)

        update_data = {"status": "done"}
        for field in ("document_type", "doctor_name", "hospital_name",
                      "document_date", "specialty", "diagnosis",
                      "recommendations", "document_category"):
            if data.get(field):
                update_data[field] = data[field]

        bill_amount = data.get("bill_amount")
        if bill_amount is not None:
            try:
                update_data["bill_amount"] = float(bill_amount)
            except (ValueError, TypeError):
                pass

        rec = supabase.table("records").select("profile_id").eq("id", record_id).execute()
        profile_id = rec.data[0]["profile_id"] if rec.data else None

        if profile_id and update_data.get("doctor_name"):
            vg = _compute_visit_group(
                profile_id,
                update_data["doctor_name"],
                update_data.get("document_date", "")
            )
            if vg:
                update_data["visit_group"] = vg

        supabase.table("records").update(update_data).eq("id", record_id).execute()

        medicines = data.get("medicines") or []
        if medicines:
            rows = [
                {
                    "record_id": record_id,
                    "name": m.get("name", "Unknown"),
                    "dosage": m.get("dosage"),
                    "frequency": m.get("frequency"),
                    "duration": m.get("duration"),
                }
                for m in medicines
                if m.get("name")
            ]
            if rows:
                supabase.table("medicines").insert(rows).execute()

    except Exception as e:
        logger.error("OCR/extraction pipeline failed for record %s: %s", record_id, e)
        supabase.table("records").update({
            "status": "failed",
            "raw_ocr_text": "Processing failed. Please try re-uploading this document."
        }).eq("id", record_id).execute()


@router.post("/upload/{profile_id}")
async def upload_file(
    profile_id: str,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    user_id: str = Depends(get_current_user),
):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    file_entries = []
    content_types = []

    for i, file in enumerate(files):
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP, GIF, BMP, PDF"
            )

        contents = await file.read()
        if len(contents) > MAX_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max 10MB per file")

        if not _content_matches_type(contents, file.content_type):
            raise HTTPException(
                status_code=400,
                detail="File content does not match its declared type"
            )

        original_name = file.filename or "upload"
        ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "bin"
        file_path = f"{user_id}/{profile_id}/{uuid.uuid4()}.{ext}"

        supabase.storage.from_("medical-records").upload(
            path=file_path,
            file=contents,
            file_options={"content-type": file.content_type},
        )

        file_url = supabase.storage.from_("medical-records").get_public_url(file_path)
        file_entries.append({"file_url": file_url, "file_path": file_path})
        content_types.append(file.content_type)

    first = file_entries[0]
    result = supabase.table("records").insert({
        "profile_id": profile_id,
        "document_type": "Unknown",
        "status": "processing",
        "file_url": first["file_url"],
        "file_path": first["file_path"],
    }).execute()

    record_id = result.data[0]["id"]

    record_file_rows = [
        {
            "record_id": record_id,
            "file_url": entry["file_url"],
            "file_path": entry["file_path"],
            "page_number": i + 1,
        }
        for i, entry in enumerate(file_entries)
    ]
    supabase.table("record_files").insert(record_file_rows).execute()

    background_tasks.add_task(process_ocr, record_id, file_entries, content_types)

    return {
        "message": "File(s) uploaded. OCR processing in background.",
        "record_id": record_id,
        "file_path": first["file_path"],
        "file_url": signed_url(first["file_path"]),
        "pages": len(file_entries),
    }
