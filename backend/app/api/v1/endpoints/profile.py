from fastapi import APIRouter, HTTPException, Depends
from app.schemas.profile import ProfileCreate, ProfileUpdate, ProfileResponse
from app.core.dependencies import get_current_user
from app.database import supabase
from app.logger import logger
from app.services.storage import BUCKET, forget_signed_urls
from typing import List

router = APIRouter()

@router.get("", response_model=List[ProfileResponse])
def get_profiles(user_id: str = Depends(get_current_user)):
    result = supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    return result.data

@router.post("", response_model=ProfileResponse)
def create_profile(body: ProfileCreate, user_id: str = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if "date_of_birth" in data and data["date_of_birth"]:
        data["date_of_birth"] = str(data["date_of_birth"])
    data["user_id"] = user_id
    result = supabase.table("profiles").insert(data).execute()
    return result.data[0]

@router.get("/{profile_id}", response_model=ProfileResponse)
def get_profile(profile_id: str, user_id: str = Depends(get_current_user)):
    result = supabase.table("profiles").select("*").eq("id", profile_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]

@router.put("/{profile_id}", response_model=ProfileResponse)
def update_profile(profile_id: str, body: ProfileUpdate, user_id: str = Depends(get_current_user)):
    existing = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = body.model_dump(exclude_none=True)
    if "date_of_birth" in data and data["date_of_birth"]:
        data["date_of_birth"] = str(data["date_of_birth"])
    result = supabase.table("profiles").update(data).eq("id", profile_id).execute()
    return result.data[0]

@router.delete("/{profile_id}")
def delete_profile(profile_id: str, user_id: str = Depends(get_current_user)):
    existing = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Collect the member's documents before the rows that point to them cascade away.
    records = supabase.table("records").select("id, file_path").eq("profile_id", profile_id).execute().data or []
    paths = {r["file_path"] for r in records if r.get("file_path")}
    if records:
        files = supabase.table("record_files").select("file_path").in_("record_id", [r["id"] for r in records]).execute()
        paths |= {f["file_path"] for f in (files.data or []) if f.get("file_path")}

    supabase.table("profiles").delete().eq("id", profile_id).eq("user_id", user_id).execute()
    if supabase.table("profiles").select("id").eq("id", profile_id).execute().data:
        raise HTTPException(status_code=500, detail="This family member could not be deleted. Please try again.")

    # Deleting a person must delete their documents, not just stop showing them.
    forget_signed_urls(paths)
    if paths:
        try:
            supabase.storage.from_(BUCKET).remove(sorted(paths))
        except Exception as e:
            logger.warning("Profile %s deleted but %d file(s) were not removed: %s", profile_id, len(paths), e)
    return {"message": "Profile deleted"}