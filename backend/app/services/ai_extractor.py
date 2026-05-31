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
    "document_type": "Prescription or Lab Report or Medical Certificate or Other",
    "doctor_name": "name of doctor",
    "hospital_name": "name of hospital or clinic",
    "document_date": "date in YYYY-MM-DD format or null",
    "specialty": "medical specialty",
    "diagnosis": "diagnosis or condition",
    "recommendations": "doctor recommendations or instructions",
    "medicines": [
        {{
            "name": "medicine name",
            "dosage": "dosage amount",
            "frequency": "how often",
            "duration": "how long"
        }}
    ]
}}

Return only the JSON, no explanation.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1000
    )

    raw = response.choices[0].message.content.strip()

    try:
        # Clean markdown if present
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except:
        return {}