from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from app.core.dependencies import get_current_user
from app.database import supabase
from app.services.ocr import extract_text_from_url
import uuid

router = APIRouter()

ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/webp", "image/gif", "image/bmp"]
MAX_SIZE = 10 * 1024 * 1024  # 10MB

def process_ocr(record_id: str, file_url: str):
    try:
        text = extract_text_from_url(file_url)
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
    # Verify profile belongs to user
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and PDF files allowed")

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB")

    # Generate unique file path
    ext = file.filename.split(".")[-1]
    file_path = f"{user_id}/{profile_id}/{uuid.uuid4()}.{ext}"

    # Upload to Supabase Storage
    supabase.storage.from_("medical-records").upload(
        path=file_path,
        file=contents,
        file_options={"content-type": file.content_type}
    )

    # Get public URL
    file_url = supabase.storage.from_("medical-records").get_public_url(file_path)

    # Create record in database
    result = supabase.table("records").insert({
        "profile_id": profile_id,
        "document_type": "Unknown",
        "status": "processing",
        "file_url": file_url,
        "file_path": file_path
    }).execute()

    record_id = result.data[0]["id"]

    # Run OCR in background
    background_tasks.add_task(process_ocr, record_id, file_url)

    return {
        "message": "File uploaded. OCR processing in background.",
        "record_id": record_id,
        "file_path": file_path,
        "file_url": file_url
    }