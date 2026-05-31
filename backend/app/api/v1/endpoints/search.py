from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user
from app.database import supabase
from typing import Optional

router = APIRouter()


@router.get("/search")
def search_records(
    q: Optional[str] = Query(None, description="Full-text search query"),
    document_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    profile_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user),
):
    # Resolve user's profile IDs
    profiles_result = supabase.table("profiles").select("id").eq("user_id", user_id).execute()
    profile_ids = [p["id"] for p in profiles_result.data]
    if not profile_ids:
        return []

    # Narrow to a specific profile if requested and owned
    if profile_id:
        if profile_id not in profile_ids:
            return []
        profile_ids = [profile_id]

    # Base query — join profiles for display name
    query = (
        supabase.table("records")
        .select("*, profiles(name, relationship)")
        .in_("profile_id", profile_ids)
        .order("created_at", desc=True)
    )

    if document_type:
        query = query.eq("document_type", document_type)
    if status:
        query = query.eq("status", status)

    # For text search, use Supabase ilike on structured fields.
    # ilike on a single column at a time; we OR across fields by fetching
    # all and filtering — acceptable for MVP scale. For production, use
    # Postgres full-text search (tsvector) instead.
    result = query.execute()
    records = result.data

    if q and q.strip():
        q_lower = q.strip().lower()
        searchable_fields = (
            "doctor_name", "hospital_name", "diagnosis",
            "raw_ocr_text", "document_type", "specialty", "recommendations"
        )
        records = [
            r for r in records
            if any(
                r.get(f) and q_lower in str(r[f]).lower()
                for f in searchable_fields
            )
        ]

    # Attach medicines to search results
    if records:
        record_ids = [r["id"] for r in records]
        meds_result = supabase.table("medicines").select("*").in_("record_id", record_ids).execute()
        meds_by_record: dict = {}
        for m in meds_result.data:
            meds_by_record.setdefault(m["record_id"], []).append(m)
        for r in records:
            r["medicines"] = meds_by_record.get(r["id"], [])

    return records
