from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user
from app.database import supabase
from typing import Optional

router = APIRouter()

@router.get("/search")
def search_records(
    q: Optional[str] = Query(None, description="Search query"),
    document_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    profile_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user)
):
    # Get all profiles for this user
    profiles = supabase.table("profiles").select("id").eq("user_id", user_id).execute()
    profile_ids = [p["id"] for p in profiles.data]

    if not profile_ids:
        return []

    # Filter by specific profile if provided
    if profile_id and profile_id in profile_ids:
        profile_ids = [profile_id]

    # Get records for all profiles
    query = supabase.table("records").select("*, profiles(name, relationship)").in_("profile_id", profile_ids)

    if document_type:
        query = query.eq("document_type", document_type)
    if status:
        query = query.eq("status", status)

    result = query.execute()
    records = result.data

    # Filter by search query
    if q:
        q_lower = q.lower()
        records = [
            r for r in records
            if (r.get("doctor_name") and q_lower in r["doctor_name"].lower()) or
               (r.get("hospital_name") and q_lower in r["hospital_name"].lower()) or
               (r.get("diagnosis") and q_lower in r["diagnosis"].lower()) or
               (r.get("raw_ocr_text") and q_lower in r["raw_ocr_text"].lower()) or
               (r.get("document_type") and q_lower in r["document_type"].lower())
        ]

    return records