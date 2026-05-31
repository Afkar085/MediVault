from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from app.core.dependencies import get_current_user
from app.database import supabase
from app.services.ocr import extract_text_from_bytes
import uuid

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/jpg", "image/webp",
    "image/gif", "image/bmp", "application/pdf"
}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


def process_ocr(record_id: str, file_path: str, content_type: str):
    try:
        file_bytes = supabase.storage.from_("medical-records").download(file_path)
        text = extract_text_from_bytes(file_bytes, content_type)

        supabase.table("records").update({
            "raw_ocr_text": text,
            "status": "extracting"
        }).eq("id", record_id).execute()

        from app.services.ai_extractor import extract_medical_data
        data = extract_medical_data(text)

        update_data = {"status": "done"}
        for field in ("document_type", "doctor_name", "hospital_name",
                      "document_date", "specialty", "diagnosis", "recommendations"):
            if data.get(field):
                update_data[field] = data[field]

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
            ]
            supabase.table("medicines").insert(rows).execute()

    except Exception as e:
        supabase.table("records").update({
            "status": "failed",
            "raw_ocr_text": str(e)
        }).eq("id", record_id).execute()


@router.post("/upload/{profile_id}")
async def upload_file(
    profile_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP, GIF, BMP, PDF"
        )

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB")

    # Sanitize filename
    original_name = file.filename or "upload"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "bin"
    file_path = f"{user_id}/{profile_id}/{uuid.uuid4()}.{ext}"

    supabase.storage.from_("medical-records").upload(
        path=file_path,
        file=contents,
        file_options={"content-type": file.content_type},
    )

    file_url = supabase.storage.from_("medical-records").get_public_url(file_path)

    result = supabase.table("records").insert({
        "profile_id": profile_id,
        "document_type": "Unknown",
        "status": "processing",
        "file_url": file_url,
        "file_path": file_path,
    }).execute()

    record_id = result.data[0]["id"]
    background_tasks.add_task(process_ocr, record_id, file_path, file.content_type)

    return {
        "message": "File uploaded. OCR processing in background.",
        "record_id": record_id,
        "file_path": file_path,
        "file_url": file_url,
    }
