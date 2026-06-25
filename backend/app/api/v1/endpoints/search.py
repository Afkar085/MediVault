from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user
from app.database import supabase
from typing import Optional
import re
from datetime import datetime

router = APIRouter()

MONTH_NAMES = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "jun": "06", "jul": "07", "aug": "08", "sep": "09",
    "sept": "09", "oct": "10", "nov": "11", "dec": "12",
}


def _match_record(r, q_lower, medicines_map, profiles_map):
    score = 0

    text_fields = {
        "doctor_name": 10,
        "hospital_name": 8,
        "specialty": 8,
        "diagnosis": 7,
        "document_type": 5,
        "recommendations": 3,
        "raw_ocr_text": 1,
    }

    for field, weight in text_fields.items():
        val = r.get(field)
        if val and q_lower in str(val).lower():
            if str(val).lower() == q_lower:
                score += weight * 3
            elif str(val).lower().startswith(q_lower):
                score += weight * 2
            else:
                score += weight

    meds = medicines_map.get(r["id"], [])
    for m in meds:
        name = (m.get("name") or "").lower()
        if q_lower in name:
            score += 12 if name == q_lower else 8

    profile = profiles_map.get(r.get("profile_id"))
    if profile:
        pname = (profile.get("name") or "").lower()
        prel = (profile.get("relationship") or "").lower()
        if q_lower in pname:
            score += 15
        if q_lower in prel:
            score += 15

    doc_date = r.get("document_date") or ""
    created = r.get("created_at") or ""
    date_str = f"{doc_date} {created}".lower()

    if re.match(r"^\d{4}$", q_lower) and q_lower in date_str:
        score += 10

    month_key = q_lower.strip()
    if month_key in MONTH_NAMES:
        month_num = MONTH_NAMES[month_key]
        if f"-{month_num}-" in doc_date or f"-{month_num}-" in created:
            score += 10

    return score


@router.get("/search")
def search_records(
    q: Optional[str] = Query(None, description="Smart search query"),
    document_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    profile_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None, description="Filter: doctor, medicine, hospital, diagnosis, family, date"),
    user_id: str = Depends(get_current_user),
):
    profiles_result = supabase.table("profiles").select("id, name, relationship").eq("user_id", user_id).execute()
    profiles = profiles_result.data
    profile_ids = [p["id"] for p in profiles]
    if not profile_ids:
        return []

    profiles_map = {p["id"]: p for p in profiles}

    if profile_id:
        if profile_id not in profile_ids:
            return []
        search_profile_ids = [profile_id]
    else:
        search_profile_ids = profile_ids

    query = (
        supabase.table("records")
        .select("*, profiles(name, relationship)")
        .in_("profile_id", search_profile_ids)
        .order("created_at", desc=True)
    )

    if document_type:
        query = query.eq("document_type", document_type)
    if status:
        query = query.eq("status", status)

    result = query.execute()
    records = result.data

    record_ids = [r["id"] for r in records]
    medicines_map = {}
    if record_ids:
        meds_result = supabase.table("medicines").select("*").in_("record_id", record_ids).execute()
        for m in meds_result.data:
            medicines_map.setdefault(m["record_id"], []).append(m)

    if q and q.strip():
        q_lower = q.strip().lower()

        if category:
            cat = category.lower()
            if cat == "doctor":
                records = [r for r in records if r.get("doctor_name") and q_lower in r["doctor_name"].lower()]
            elif cat == "medicine":
                records = [r for r in records if any(q_lower in (m.get("name") or "").lower() for m in medicines_map.get(r["id"], []))]
            elif cat == "hospital":
                records = [r for r in records if r.get("hospital_name") and q_lower in r["hospital_name"].lower()]
            elif cat == "diagnosis" or cat == "disease":
                records = [r for r in records if r.get("diagnosis") and q_lower in r["diagnosis"].lower()]
            elif cat == "family":
                records = [r for r in records if profiles_map.get(r.get("profile_id")) and q_lower in (profiles_map[r["profile_id"]].get("name") or "").lower()]
            elif cat == "department":
                records = [r for r in records if r.get("specialty") and q_lower in r["specialty"].lower()]
            elif cat == "date":
                records = [r for r in records if q_lower in (r.get("document_date") or "") or q_lower in (r.get("created_at") or "")]
            else:
                scored = [(r, _match_record(r, q_lower, medicines_map, profiles_map)) for r in records]
                records = [r for r, s in sorted(scored, key=lambda x: -x[1]) if s > 0]
        else:
            scored = [(r, _match_record(r, q_lower, medicines_map, profiles_map)) for r in records]
            records = [r for r, s in sorted(scored, key=lambda x: -x[1]) if s > 0]

    for r in records:
        r["medicines"] = medicines_map.get(r["id"], [])

    return records
