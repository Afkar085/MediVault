"""Grounded question-answering over a patient's own medical records (RAG).

The retrieved records become the *only* allowed source of truth; the model is
instructed to answer strictly from them and to cite record numbers, which keeps
answers grounded and reduces hallucination.

Each record contributes two things: the fields the extractor pulled out (doctor,
diagnosis, medicines), and the passages of the scanned document that are actually
relevant to the question. The second matters — a haemoglobin value or a specific
instruction lives in the document text and was never extracted into a column, so
without the passages the model can only ever say it doesn't know.
"""
import logging
from typing import List, Optional, Tuple

from groq import Groq

from app.config import settings
from app.services.passages import relevant_passages

logger = logging.getLogger(__name__)

# Someone is waiting on this response, so fail fast rather than hang the request.
client = Groq(api_key=settings.GROQ_API_KEY, timeout=45.0, max_retries=1)

# How many records to put in front of the model. Enough to answer a question
# spanning a few visits, small enough to stay grounded and cheap.
CONTEXT_RECORD_LIMIT = 6

NOT_IN_RECORDS = (
    "I couldn't find that in the uploaded records. Try naming a doctor, "
    "a medicine or a condition that appears in them."
)

PROMPT_TEMPLATE = """You are a careful medical-records assistant. Answer the question using ONLY the records below for {patient}.

Each record shows the details extracted from it, and where available the exact text of the document itself under "From the document".

Rules:
- Use only what is written below. Do not use outside knowledge and do not infer values that are not shown.
- Quote figures, doses and dates exactly as they appear. Never round, convert or estimate them.
- If the answer is not in these records, say so plainly. Do not guess.
- Cite the records you used, like [Record 1]. Use plain square brackets exactly like that, not any other bracket character.
- Answer in the same language the question was asked in.
- Do not diagnose, and do not advise starting, stopping or changing any treatment.

Records:
{context}

Question: {question}

Answer:"""


# Long enough to recognise the sentence an answer came from, short enough not
# to reproduce the document in the UI.
EXCERPT_CHARS = 240


def _excerpt(text: str) -> str:
    cleaned = " ".join(text.split())
    return cleaned if len(cleaned) <= EXCERPT_CHARS else cleaned[:EXCERPT_CHARS].rstrip() + "…"


def build_context(
    records: List[dict], question: Optional[str] = None
) -> Tuple[str, List[dict]]:
    """Format records into a numbered context block + a parallel sources list.

    When a question is given, each record also carries the passages of its
    scanned text that match it.
    """
    passages_by_record: dict = {}
    if question:
        record_ids = [r["id"] for r in records if r.get("id")]
        try:
            for passage in relevant_passages(record_ids, question):
                passages_by_record.setdefault(passage["record_id"], []).append(passage["text"])
        except Exception as e:
            # Losing the passages costs precision, not correctness: the answer
            # falls back to the extracted fields rather than failing outright.
            logger.warning("Passage retrieval failed, answering from fields only: %s", e)

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

        entry = " | ".join(parts)
        quoted = passages_by_record.get(r.get("id"))
        if quoted:
            excerpts = "\n".join(f'  """{text}"""' for text in quoted)
            entry = f"{entry}\nFrom the document:\n{excerpts}"
        lines.append(entry)

        sources.append(
            {
                "ref": i,
                "record_id": r.get("id"),
                "profile_id": r.get("profile_id"),
                "date": date,
                "doctor_name": r.get("doctor_name"),
                "excerpt": _excerpt(quoted[0]) if quoted else None,
            }
        )
    return "\n\n".join(lines), sources


def answer_question(question: str, records: List[dict], profile: dict) -> dict:
    """Answer a question grounded only in the provided records, with citations."""
    if not records:
        return {"answer": NOT_IN_RECORDS, "sources": []}

    context, sources = build_context(records, question)
    prompt = PROMPT_TEMPLATE.format(
        patient=profile.get("name", "the patient"),
        context=context,
        question=question,
    )

    try:
        response = client.chat.completions.create(
            model=settings.GROQ_TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            # Headroom for reasoning-model tokens (gpt-oss-120b) so the grounded
            # answer isn't truncated by internal reasoning.
            max_tokens=1500,
        )
        answer = (response.choices[0].message.content or "").strip()
    except Exception as e:
        logger.error("RAG answer generation failed: %s", e)
        return {"answer": "Sorry, I couldn't generate an answer right now.", "sources": sources}

    if not answer:
        return {"answer": NOT_IN_RECORDS, "sources": sources}
    return {"answer": answer, "sources": sources}
