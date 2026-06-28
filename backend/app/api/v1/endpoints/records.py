from fastapi import APIRouter, HTTPException, Depends, Query
from app.schemas.record import RecordResponse, RecordUpdate, RecordEditResponse
from app.core.dependencies import get_current_user
from app.database import supabase
from typing import List, Optional
from groq import Groq
from app.config import settings

router = APIRouter()


def _attach_medicines(records: list) -> list:
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


def _attach_files(records: list) -> list:
    if not records:
        return records
    record_ids = [r["id"] for r in records]
    files_result = supabase.table("record_files").select("*").in_("record_id", record_ids).order("page_number").execute()
    files_by_record: dict = {}
    for f in files_result.data:
        files_by_record.setdefault(f["record_id"], []).append(f)
    for r in records:
        r["files"] = files_by_record.get(r["id"], [])
    return records


def _assert_profile_owned(profile_id: str, user_id: str):
    profile = supabase.table("profiles").select("id").eq("id", profile_id).eq("user_id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")


@router.get("/{profile_id}/records", response_model=None)
def get_records(
    profile_id: str,
    document_category: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user),
):
    _assert_profile_owned(profile_id, user_id)
    query = supabase.table("records").select("*").eq("profile_id", profile_id).order("created_at", desc=True)
    if document_category:
        query = query.eq("document_category", document_category)
    result = query.execute()
    records = _attach_medicines(result.data)
    records = _attach_files(records)
    return records


@router.get("/{profile_id}/records/{record_id}", response_model=None)
def get_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    result = supabase.table("records").select("*").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    records = _attach_medicines(result.data)
    records = _attach_files(records)
    return records[0]


@router.put("/{profile_id}/records/{record_id}", response_model=None)
def update_record(profile_id: str, record_id: str, body: RecordUpdate, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    existing_result = supabase.table("records").select("*").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not existing_result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    existing = existing_result.data[0]

    data = body.model_dump(exclude_none=True)

    # Extract fields that need separate handling before Supabase update
    medicines_data = data.pop("medicines", None)
    # Bill-specific fields saved separately so missing columns don't break main update
    bill_extra = {k: data.pop(k, None) for k in ("bill_category", "bill_title", "bill_number")}

    if "document_date" in data and data["document_date"]:
        data["document_date"] = str(data["document_date"])

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

    if data:
        result = supabase.table("records").update(data).eq("id", record_id).eq("profile_id", profile_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Record not found")
    else:
        result = supabase.table("records").select("*").eq("id", record_id).eq("profile_id", profile_id).execute()

    # Save bill_title/bill_category/bill_number — requires those columns in records table
    bill_extra_clean = {k: v for k, v in bill_extra.items() if v is not None}
    if bill_extra_clean:
        try:
            supabase.table("records").update(bill_extra_clean).eq("id", record_id).eq("profile_id", profile_id).execute()
            if result.data:
                result.data[0].update(bill_extra_clean)
        except Exception:
            pass

    # Save medicines: delete old, insert new
    if medicines_data is not None:
        supabase.table("medicines").delete().eq("record_id", record_id).execute()
        if medicines_data:
            insert_rows = []
            for m in medicines_data:
                name = (m.get("name") or "").strip()
                if not name:
                    continue
                insert_rows.append({
                    "record_id": record_id,
                    "name": name,
                    "dosage": m.get("dosage") or None,
                    "frequency": m.get("frequency") or None,
                    "duration": m.get("duration") or None,
                })
            if insert_rows:
                supabase.table("medicines").insert(insert_rows).execute()

    records = _attach_medicines(result.data)
    records = _attach_files(records)
    return records[0]


@router.delete("/{profile_id}/records/{record_id}")
def delete_record(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    files_result = supabase.table("record_files").select("file_path").eq("record_id", record_id).execute()
    record_result = supabase.table("records").select("file_path").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not record_result.data:
        raise HTTPException(status_code=404, detail="Record not found")

    paths_to_delete = []
    main_path = record_result.data[0].get("file_path")
    if main_path:
        paths_to_delete.append(main_path)
    for f in files_result.data:
        p = f.get("file_path")
        if p and p not in paths_to_delete:
            paths_to_delete.append(p)

    if paths_to_delete:
        try:
            supabase.storage.from_("medical-records").remove(paths_to_delete)
        except Exception:
            pass

    supabase.table("records").delete().eq("id", record_id).eq("profile_id", profile_id).execute()
    return {"message": "Record deleted"}


@router.put("/{profile_id}/records/{record_id}/insurance")
def toggle_insurance(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    existing = supabase.table("records").select("insurance_claimed").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Record not found")
    current = existing.data[0].get("insurance_claimed", False)
    result = supabase.table("records").update({"insurance_claimed": not current}).eq("id", record_id).execute()
    return result.data[0]


@router.get("/{profile_id}/bills")
def get_bills(profile_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    result = (
        supabase.table("records")
        .select("*")
        .eq("profile_id", profile_id)
        .eq("document_category", "bill")
        .order("document_date", desc=True)
        .execute()
    )
    records = _attach_files(result.data)

    months = {}
    total_spent = 0
    total_claimed = 0
    for r in records:
        amt = float(r.get("bill_amount") or 0)
        total_spent += amt
        if r.get("insurance_claimed"):
            total_claimed += amt

        date_str = r.get("document_date") or (r.get("created_at") or "")[:10]
        month_key = date_str[:7] if date_str else "Unknown"
        if month_key not in months:
            months[month_key] = {"month": month_key, "total": 0, "bills": []}
        months[month_key]["total"] += amt
        months[month_key]["bills"].append(r)

    return {
        "summary": {
            "total_spent": total_spent,
            "total_claimed": total_claimed,
            "unclaimed": total_spent - total_claimed,
        },
        "months": list(months.values()),
    }


@router.get("/{profile_id}/health-journey")
def get_health_journey(profile_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)

    profile_result = supabase.table("profiles").select("name, relationship").eq("id", profile_id).execute()
    profile = profile_result.data[0] if profile_result.data else {"name": "Patient", "relationship": "Self"}

    records_result = supabase.table("records").select("*").eq("profile_id", profile_id).eq("status", "done").order("created_at", desc=False).execute()
    records = _attach_medicines(records_result.data)

    if not records:
        return {"summary": "No medical records yet. Upload prescriptions to build your health journey."}

    visits = []
    for r in records:
        date = r.get("document_date") or (r.get("created_at") or "")[:10]
        meds = ", ".join(m.get("name", "") for m in r.get("medicines", []))
        entry = f"Date: {date}"
        if r.get("doctor_name"):
            entry += f" | Doctor: {r['doctor_name']}"
        if r.get("specialty"):
            entry += f" | Dept: {r['specialty']}"
        if r.get("hospital_name"):
            entry += f" | Hospital: {r['hospital_name']}"
        if r.get("diagnosis"):
            entry += f" | Diagnosis: {r['diagnosis']}"
        if meds:
            entry += f" | Medicines: {meds}"
        if r.get("recommendations"):
            entry += f" | Notes: {r['recommendations']}"
        visits.append(entry)

    visit_text = "\n".join(visits)

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{
                "role": "user",
                "content": f"""Summarize this patient's health journey as a concise timeline narrative.
Patient: {profile.get('name')} ({profile.get('relationship')})

Medical visits:
{visit_text}

Write 3-8 bullet points summarizing the health journey chronologically.
Focus on: key diagnoses, treatment progression, medication changes, follow-up outcomes.
Use simple language a patient would understand.
Format each point starting with the month/year, then the event.
Return ONLY the bullet points, no intro or outro."""
            }],
            temperature=0.3,
            max_tokens=500,
        )
        summary = response.choices[0].message.content.strip()
    except Exception as e:
        summary = f"Unable to generate health journey: {str(e)}"

    return {"summary": summary, "total_visits": len(records)}


@router.get("/{profile_id}/records/{record_id}/history", response_model=List[RecordEditResponse])
def get_record_history(profile_id: str, record_id: str, user_id: str = Depends(get_current_user)):
    _assert_profile_owned(profile_id, user_id)
    record_result = supabase.table("records").select("id").eq("id", record_id).eq("profile_id", profile_id).execute()
    if not record_result.data:
        raise HTTPException(status_code=404, detail="Record not found")
    result = supabase.table("record_edits").select("*").eq("record_id", record_id).order("edited_at", desc=True).execute()
    return result.data
