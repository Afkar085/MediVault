from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.core.dependencies import get_current_user
from app.database import supabase
import uuid

router = APIRouter()

ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
MAX_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("/upload/{profile_id}")
async def upload_file(
    profile_id: str,
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

    return {
        "message": "File uploaded successfully",
        "record_id": result.data[0]["id"],
        "file_path": file_path,
        "file_url": file_url
    }