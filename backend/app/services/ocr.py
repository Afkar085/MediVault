import base64
import io
import json
from groq import Groq
from app.config import settings

client = Groq(api_key=settings.GROQ_API_KEY)


def extract_text_from_bytes(file_bytes: bytes, content_type: str = "") -> str:
    try:
        if content_type == "application/pdf" or file_bytes[:4] == b"%PDF":
            return _extract_from_pdf(file_bytes)
        return _extract_from_image(file_bytes)
    except Exception as e:
        return f"OCR failed: {str(e)}"


def _extract_from_image(image_bytes: bytes) -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    mime = "image/jpeg"
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        mime = "image/png"
    elif image_bytes[:4] == b'RIFF':
        mime = "image/webp"

    response = client.chat.completions.create(
        model="llama-3.2-90b-vision-preview",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract ALL text from this image exactly as written. Include every word, number, date, name, address, and detail. Return only the extracted text, nothing else."},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        temperature=0,
        max_tokens=2000,
    )

    text = response.choices[0].message.content.strip()
    return text if text else "No text found in image"


def _extract_from_pdf(pdf_bytes: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        text = pdfminer_extract(io.BytesIO(pdf_bytes))
        if text and text.strip():
            return text.strip()
    except Exception:
        pass

    return "PDF text extraction failed. Try uploading as an image instead."
