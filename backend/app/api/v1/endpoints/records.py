from fastapi import APIRouter, HTTPException, Depends
from app.schemas.record import RecordResponse, RecordUpdate, RecordEditResponse
from app.core.dependencies import get_current_user
from app.database import supabase
from typing import List

router = APIRouter()


def _attach_medicines(records: list) -> list:
    """Fetch and attach medicines to a list of record dicts."""
    if not records:
        return records
    record_ids = [r["id"] for r in records]
    meds_result = supabase.table("medicines").select("*").in_("record_id", record_ids).execute()
    meds_by_record: dict = {}
    for m in meds_result.data:
        meds_by_record.setdefault(m["record_id"], []).append(m)
    for r in records:
        r["medicines"] = meds_by_record.get(r["id"], [])
    return records


def _assert_profile_owned(profile_id: str, user_id: str):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")


@router.get("/{profile_id}/records", response_model=List[RecordResponse])
def get_records(profile_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    result = supabase.table("records").select("*").eq("profile_id", profile_id).order("created_at", desc=True).execute()
    return _attach_medicines(result.data)


@router.get("/{profile_id}/records/{record_id}", response_model=RecordResponse)
def get_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    result = supabase.table("records").select("*").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    return _attach_medicines(result.data)[0]


@router.put("/{profile_id}/records/{record_id}", response_model=RecordResponse)
def update_record(profile_id: str, record_id: str, body: RecordUpdate, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    # Fetch existing record to diff for audit trail
    existing_result = supabase.table("records").select("*").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not existing_result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    existing = existing_result.data[0]

    data = body.model_dump(exclude_none=True)
    if "document_date" in data and data["document_date"]:
        data["document_date"] = str(data["document_date"])

    # Write audit entries for each changed field
    edits = []
    for field, new_val in data.items():
        old_val = existing.get(field)
        if str(old_val) != str(new_val):
            edits.append({
                "record_id": record_id,
                "field_name": field,
                "old_value": str(old_val) if old_val is not None else None,
                "new_value": str(new_val),
            })
    if edits:
        supabase.table("record_edits").insert(edits).execute()

    result = supabase.table("records").update(data).eq("id", record_id).eq("profile_id", profile_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    return _attach_medicines(result.data)[0]


@router.delete("/{profile_id}/records/{record_id}")
def delete_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    # Also clean up from storage if file_path exists
    record_result = supabase.table("records").select("file_path").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not record_result.data:
        raise HTTPException(status_code=404, detail="Record not found")

    file_path = record_result.data[0].get("file_path")
    if file_path:
        try:
            supabase.storage.from_("medical-records").remove([file_path])
        except Exception:
            pass  # Don't fail delete if storage cleanup fails

    supabase.table("records").delete().eq("id", record_id).eq("profile_id", profile_id).execute()
    return {"message": "Record deleted"}


@router.get("/{profile_id}/records/{record_id}/history", response_model=List[RecordEditResponse])
def get_record_history(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    # Verify record belongs to profile
    record_result = supabase.table("records").select("id").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not record_result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    result = supabase.table("record_edits").select("*").eq("record_id", record_id).order("edited_at", desc=True).execute()
    return result.data
