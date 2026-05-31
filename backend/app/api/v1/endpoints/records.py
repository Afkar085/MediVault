from fastapi import APIRouter, HTTPException, Depends
from app.schemas.record import RecordResponse, RecordUpdate
from app.core.dependencies import get_current_user
from app.database import supabase
from typing import List

router = APIRouter()

@router.get("/{profile_id}/records", response_model=List[RecordResponse])
def get_records(profile_id: str, user_id: str = Depends(get_current_user)):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    result = supabase.table("records").select("*").eq("profile_id", profile_id).execute()
    return result.data

@router.get("/{profile_id}/records/{record_id}", response_model=RecordResponse)
def get_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    result = supabase.table("records").select("*").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    return result.data[0]

@router.put("/{profile_id}/records/{record_id}", response_model=RecordResponse)
def update_record(profile_id: str, record_id: str, body: RecordUpdate, user_id: str = Depends(get_current_user)):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = body.model_dump(exclude_none=True)
    if "document_date" in data and data["document_date"]:
        data["document_date"] = str(data["document_date"])
    result = supabase.table("records").update(data).eq("id", record_id).eq("profile_id", profile_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    return result.data[0]

@router.delete("/{profile_id}/records/{record_id}")
def delete_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    supabase.table("records").delete().eq("id", record_id).eq("profile_id", profile_id).execute()
    return {"message": "Record deleted"}