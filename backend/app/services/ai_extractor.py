import json
from groq import Groq
from app.config import settings

client = Groq(api_key=settings.GROQ_API_KEY)

def extract_medical_data(ocr_text: str) -> dict:
    prompt = f"""
You are a medical document parser. Extract structured information from this OCR text of a medical document.

OCR Text:
{ocr_text}

Return ONLY a JSON object with these fields (use null if not found):
{{
    "document_type": "Prescription or Lab Report or Medical Certificate or Discharge Summary or Other",
    "document_category": "prescription or lab_report or bill or discharge_summary or other",
    "doctor_name": "name of doctor",
    "hospital_name": "name of hospital or clinic",
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

Rules for bill_amount:
- If this is a bill/invoice/receipt, extract the total amount as a number (no currency symbol)
- If not a bill, set to null

Return only the JSON, no explanation.
"""

    response = client.chat.completions.create(
        model=settings.GROQ_TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1000
    )

    raw = response.choices[0].message.content.strip()

    try:
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except:
        return {}