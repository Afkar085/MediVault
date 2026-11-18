from fastapi import APIRouter, HTTPException, Depends
from app.schemas.profile import ProfileCreate, ProfileUpdate, ProfileResponse
from app.core.dependencies import get_current_user
from app.database import supabase
from app.logger import logger
from app.services.document_files import thumbnail_path
from app.services.storage import BUCKET, forget_signed_urls
from typing import List

router = APIRouter()

HEALTH_FIELDS = ("allergies", "conditions", "long_term_medicines", "blood_group")
NEEDS_MIGRATION = "Health details can be saved once migration 011 has been run in Supabase."


def _write(query_for, data: dict):
    """Run an insert or update. If the health columns are not there yet
    (migration 011 not run), say so instead of failing with a 500."""
    try:
        return query_for(data).execute()
    except Exception as e:
        message = str(e).lower()
        if any(f in data for f in HEALTH_FIELDS) and ("column" in message or "42703" in message):
            raise HTTPException(status_code=400, detail=NEEDS_MIGRATION) from e
        raise

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
    result = _write(lambda d: supabase.table("profiles").insert(d), data)
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
    result = _write(lambda d: supabase.table("profiles").update(d).eq("id", profile_id), data)
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
    paths |= {thumbnail_path(p) for p in paths}
    forget_signed_urls(paths)
    if paths:
        try:
            supabase.storage.from_(BUCKET).remove(sorted(paths))
        except Exception as e:
            logger.warning("Profile %s deleted but %d file(s) were not removed: %s", profile_id, len(paths), e)
    return {"message": "Profile deleted"}