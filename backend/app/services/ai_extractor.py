import json
import logging
import random
import time
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY, timeout=90.0, max_retries=1)

# Reading the document and understanding it are two separate model calls. The
# second one failing used to mark the whole record unreadable, so a
# prescription whose text had been read perfectly was shown as "couldn't be
# read". A rate limit or a gateway error is waited out first; if it still will
# not answer, the caller keeps the text and leaves the details blank.
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = (1.5, 4.0)


def _is_retryable(error: Exception) -> bool:
    status = getattr(error, "status_code", None)
    if status == 429 or (isinstance(status, int) and status >= 500):
        return True
    message = str(error).lower()
    return any(w in message for w in ("timeout", "timed out", "connection", "temporarily"))


def _ask(prompt: str):
    """The model's reply, or None if it could not be obtained."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        started = time.monotonic()
        try:
            return client.chat.completions.create(
                model=settings.GROQ_TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                # gpt-oss-120b is a reasoning model: reasoning tokens count
                # against the completion budget, so keep this generous enough
                # to leave room for the actual JSON after internal reasoning.
                max_tokens=3000,
                # Guarantee the content channel is a JSON object (supported by
                # both gpt-oss and qwen text models). The prompt asks for JSON.
                response_format={"type": "json_object"},
            )
        except Exception as e:
            took = time.monotonic() - started
            if attempt < MAX_ATTEMPTS and _is_retryable(e):
                delay = BACKOFF_SECONDS[min(attempt - 1, len(BACKOFF_SECONDS) - 1)]
                delay += random.uniform(0, 0.5)
                logger.info(
                    "Extraction call failed (%s, attempt %d/%d, %.2fs); retrying in %.1fs",
                    type(e).__name__, attempt, MAX_ATTEMPTS, took, delay,
                )
                time.sleep(delay)
                continue
            logger.warning(
                "Extraction call failed after %d attempt(s), %.2fs: %s",
                attempt, took, str(e)[:200],
            )
            return None
    return None


def extract_medical_data(ocr_text: str) -> dict:
    prompt = f"""
You are a medical document parser. Extract structured information from this OCR text of a medical document.

OCR Text:
{ocr_text}

Return ONLY a JSON object with these fields (use null if not found):
{{
    "document_type": "Prescription or Lab Report or Medical Certificate or Discharge Summary or Other",
    "document_category": "prescription or lab_report or bill or discharge_summary or other",
    "doctor_name": "name of the doctor, or null",
    "hospital_name": "name of the hospital, clinic, lab, pharmacy or business that issued it",
    "document_date": "date in YYYY-MM-DD format or null",
    "specialty": "medical specialty",
    "diagnosis": "diagnosis or condition",
    "recommendations": "doctor recommendations or instructions",
    "bill_amount": null,
    "medicines": [
        {{
            "name": "medicine name",
            "dosage": "dosage amount",
            "frequency": "how often",
            "duration": "how long"
        }}
    ]
}}

Rules for document_category:
- If it's a prescription or has medicines listed: "prescription"
- If it's a lab report, blood test, urine test, pathology report: "lab_report"
- If it's a bill, invoice, receipt with amounts: "bill"
- If it's a discharge summary from hospital: "discharge_summary"
- Otherwise: "other"

Rules for doctor_name:
- Only a person identified as a doctor (for example "Dr.", "MBBS", "MD", "Consultant", or a doctor's signature block).
- Never a shop, restaurant, pharmacy, hospital or lab name. If no doctor is named, use null.

Rules for medicines:
- List every medicine written on the document, including brand names and abbreviations (e.g. "Azee 500mg BD x 5 days" gives name "Azee 500mg", frequency "BD", duration "5 days").
- Copy dosage, frequency and duration only as written. If one is not written, use null. Never guess them.
- Each entry is an object with name, dosage, frequency and duration.

Rules for document_date:
- The date printed or written on the document, converted to YYYY-MM-DD. If no date is written, use null. Never use today's date.

Rules for bill_amount:
- If this is a bill/invoice/receipt, extract the total amount as a number (no currency symbol)
- If not a bill, set to null

Return only the JSON, no explanation.
"""

    response = _ask(prompt)
    if response is None:
        return {}

    raw = (response.choices[0].message.content or "").strip()
    if not raw:
        logger.warning("Extraction returned an empty response; keeping the document text only")
        return {}

    try:
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        # The model returned something that isn't valid JSON. Its output is the
        # patient's medical details, so only its shape is logged, never the text.
        logger.error(
            "Failed to parse extraction JSON (%s); %d characters returned", e, len(raw)
        )
        return {}