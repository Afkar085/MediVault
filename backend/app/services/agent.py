"""A bounded tool-calling loop over a family's own medical records.

This is not a chat assistant. It answers one question by choosing among a fixed
set of read-only tools (see agent_tools.py), all of which are already scoped to
the authenticated user's profiles, and then answers strictly from what those
tools returned.

The loop is deliberately small: a hard cap on rounds, a hard cap on tool calls,
and any failure falls back to plain retrieval rather than leaving the user with
nothing.
"""
import json
import logging
from typing import List, Optional

from groq import Groq

from app.config import settings
from app.services.agent_tools import TOOL_SCHEMAS, RecordTools

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY, timeout=60.0, max_retries=1)

# Enough to look up who "Dad" is, pull the right history, and answer. Beyond
# this the model is going in circles, and each round costs a request.
MAX_ROUNDS = 4
MAX_TOOL_CALLS = 8

SYSTEM_PROMPT = """You are MediVault's records assistant. You answer questions about a family's own uploaded medical documents.

Rules:
- Use the tools to look things up. Never answer from memory or general medical knowledge.
- If the question names a person ("Dad", "my mother", a first name), call list_family_members first to find out who that is.
- For anything that would be written on the document rather than summarised (a test value or reading, an exact instruction, the wording the doctor used), call retrieve_document_context. The other tools only return extracted fields and will not contain it.
- Quote figures, doses and dates exactly as they appear. Never round, convert or estimate them.
- If the tools return nothing relevant, say you could not find it in the uploaded records. Never guess, and never invent a medicine, dose, date, doctor or result.
- Answer in two or three plain sentences. Write for a patient, not a clinician.
- Use ordinary punctuation. Never use an em dash; use a comma, a full stop or brackets instead.
- Bold only the names that matter (a medicine, a doctor, a diagnosis, a test) with **double asterisks**. Do not bold whole sentences.
- Do not diagnose, and do not advise starting, stopping or changing any treatment. If asked for that, say the records only show what was prescribed and they should speak to their doctor.
- Mention dates and who the record belongs to when it matters."""


def answer_with_tools(question: str, tools: RecordTools) -> Optional[dict]:
    """Answer via tool calls, or None if the model could not complete the loop.

    Returning None (rather than raising or fabricating) lets the caller fall
    back to plain retrieval, so the feature degrades instead of breaking.
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    used: List[dict] = []
    calls_made = 0

    for _ in range(MAX_ROUNDS):
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_TEXT_MODEL,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                temperature=0.2,
                max_tokens=1600,
            )
        except Exception as e:
            logger.error("Agent request failed: %s", e)
            return None

        message = response.choices[0].message
        tool_calls = getattr(message, "tool_calls", None)

        if not tool_calls:
            answer = (message.content or "").strip()
            if not answer:
                return None
            return {"answer": answer, "sources": _sources(used), "used_tools": [u["tool"] for u in used]}

        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                    for call in tool_calls
                ],
            }
        )

        for call in tool_calls:
            if calls_made >= MAX_TOOL_CALLS:
                result = {"error": "Too many lookups for one question."}
            else:
                calls_made += 1
                try:
                    arguments = json.loads(call.function.arguments or "{}")
                except json.JSONDecodeError:
                    arguments = {}
                result = tools.call(call.function.name, arguments)
                used.append({"tool": call.function.name, "result": result})

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result, default=str)[:12000],
                }
            )

    logger.warning("Agent hit the round limit without answering")
    return None


# Long enough to recognise the sentence an answer came from, short enough not
# to reproduce the document in the UI.
EXCERPT_CHARS = 240


def _excerpt(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    cleaned = " ".join(text.split())
    return cleaned if len(cleaned) <= EXCERPT_CHARS else cleaned[:EXCERPT_CHARS].rstrip() + "…"


def _sources(used: List[dict]) -> List[dict]:
    """The records the tools actually surfaced, so the answer can be checked."""
    sources: List[dict] = []
    seen = set()
    for entry in used:
        result = entry.get("result") or {}
        if not isinstance(result, dict):
            continue
        rows: List[dict] = []
        for value in result.values():
            if isinstance(value, list):
                rows.extend(item for item in value if isinstance(item, dict))
        if "record_id" in result:
            rows.append(result)
        for row in rows:
            record_id = row.get("record_id")
            if not record_id or record_id in seen:
                continue
            seen.add(record_id)
            sources.append(
                {
                    "ref": len(sources) + 1,
                    "record_id": record_id,
                    "profile_id": row.get("profile_id"),
                    "date": row.get("date"),
                    "doctor_name": row.get("doctor"),
                    "member": row.get("member"),
                    # Present when the answer came from the document text, so
                    # the reader can check the wording without opening the file.
                    "excerpt": _excerpt(row.get("text")),
                }
            )
    return sources[:8]
