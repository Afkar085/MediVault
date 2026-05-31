from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from app.core.dependencies import get_current_user
from app.database import supabase
from app.services.ocr import extract_text_from_bytes
import uuid

router = APIRouter()

ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/webp", "image/gif", "image/bmp"]
MAX_SIZE = 10 * 1024 * 1024  # 10MB

def process_ocr(record_id: str, file_path: str):
    try:
        image_bytes = supabase.storage.from_("medical-records").download(file_path)
        text = extract_text_from_bytes(image_bytes)
        supabase.table("records").update({
            "raw_ocr_text": text,
            "status": "ocr_done"
        }).eq("id", record_id).execute()
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
    user_id: str = Depends(get_current_user)
):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and PDF files allowed")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB")

    ext = file.filename.split(".")[-1]
    file_path = f"{user_id}/{profile_id}/{uuid.uuid4()}.{ext}"

    supabase.storage.from_("medical-records").upload(
        path=file_path,
        file=contents,
        file_options={"content-type": file.content_type}
    )

    file_url = supabase.storage.from_("medical-records").get_public_url(file_path)

    result = supabase.table("records").insert({
        "profile_id": profile_id,
        "document_type": "Unknown",
        "status": "processing",
        "file_url": file_url,
        "file_path": file_path
    }).execute()

    record_id = result.data[0]["id"]
    background_tasks.add_task(process_ocr, record_id, file_path)

    return {
        "message": "File uploaded. OCR processing in background.",
        "record_id": record_id,
        "file_path": file_path,
        "file_url": file_url
    }