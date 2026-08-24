"""Ask a question across the whole family's records.

The model reaches the data only through app/services/agent_tools.py, which is
constructed from the profiles this user owns. If the tool loop cannot finish,
we fall back to plain retrieval plus a grounded answer rather than failing.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user
from app.database import supabase
from app.limiter import limiter
from app.logger import logger
from app.services import agent, rag
from app.services.rag import CONTEXT_RECORD_LIMIT, NOT_IN_RECORDS
from app.services.agent_tools import RecordTools
from app.services.record_assembly import attach_medicines
from app.services.retrieval import select_context_records

router = APIRouter()

_FALLBACK_COLUMNS = (
    "id, profile_id, document_type, document_category, status, doctor_name, "
    "hospital_name, document_date, specialty, diagnosis, recommendations, created_at"
)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


def _fallback(question: str, profiles: list) -> dict:
    """Plain retrieval when the tool loop is unavailable."""
    profile_ids = [p["id"] for p in profiles]
    rows = (
        supabase.table("records")
        .select(_FALLBACK_COLUMNS)
        .in_("profile_id", profile_ids)
        .eq("status", "done")
        .order("document_date", desc=True)
        .execute()
        .data
        or []
    )
    candidates = attach_medicines(rows)
    records = select_context_records(candidates, question, limit=CONTEXT_RECORD_LIMIT)
    if not records:
        return {"answer": NOT_IN_RECORDS, "sources": []}

    names = ", ".join(p.get("name", "") for p in profiles if p.get("name"))
    return rag.answer_question(question, records, {"name": names or "the family"})


@router.post("/ask")
@limiter.limit("15/minute")
def ask_family(request: Request, body: AskRequest, user_id: str = Depends(get_current_user)):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty")

    profiles = (
        supabase.table("profiles")
        .select("id, name, relationship")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    if not profiles:
        return {"answer": "There are no family members set up yet.", "sources": []}

    try:
        answered = agent.answer_with_tools(question, RecordTools(profiles))
    except Exception as e:
        logger.error("Assistant failed, falling back to retrieval: %s", e)
        answered = None

    return answered or _fallback(question, profiles)
