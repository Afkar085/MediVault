"""Grounded question-answering over a patient's own medical records (RAG).

The retrieved records become the *only* allowed source of truth; the model is
instructed to answer strictly from them and to cite record numbers, which keeps
answers grounded and reduces hallucination.
"""
import logging
from typing import List, Tuple

from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY)


def build_context(records: List[dict]) -> Tuple[str, List[dict]]:
    """Format records into a numbered context block + a parallel sources list."""
    lines = []
    sources = []
    for i, r in enumerate(records, start=1):
        date = r.get("document_date") or (r.get("created_at") or "")[:10]
        meds = ", ".join(m.get("name", "") for m in (r.get("medicines") or []) if m.get("name"))
        parts = [f"[Record {i}] Date: {date or 'unknown'}"]
        if r.get("doctor_name"):
            parts.append(f"Doctor: {r['doctor_name']}")
        if r.get("specialty"):
            parts.append(f"Dept: {r['specialty']}")
        if r.get("hospital_name"):
            parts.append(f"Hospital: {r['hospital_name']}")
        if r.get("diagnosis"):
            parts.append(f"Diagnosis: {r['diagnosis']}")
        if meds:
            parts.append(f"Medicines: {meds}")
        if r.get("recommendations"):
            parts.append(f"Notes: {r['recommendations']}")
        lines.append(" | ".join(parts))
        sources.append(
            {
                "ref": i,
                "record_id": r.get("id"),
                "date": date,
                "doctor_name": r.get("doctor_name"),
            }
        )
    return "\n".join(lines), sources


def answer_question(question: str, records: List[dict], profile: dict) -> dict:
    """Answer a question grounded only in the provided records, with citations."""
    if not records:
        return {
            "answer": "I couldn't find any relevant records to answer that. "
            "Try uploading more documents or rephrasing your question.",
            "sources": [],
        }

    context, sources = build_context(records)
    prompt = f"""You are a careful medical-records assistant. Answer the question \
using ONLY the records below for {profile.get('name', 'the patient')}. \
Do not use outside knowledge or invent details. If the answer is not in the \
records, say you don't have that information. Cite the records you used like \
[Record 1], [Record 2].

Records:
{context}

Question: {question}

Answer:"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=600,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error("RAG answer generation failed: %s", e)
        return {"answer": "Sorry, I couldn't generate an answer right now.", "sources": sources}

    return {"answer": answer, "sources": sources}
