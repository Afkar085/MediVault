import base64
import io
import json
from groq import Groq
from app.config import settings

client = Groq(api_key=settings.GROQ_API_KEY)

# Cap how many pages of a scanned PDF we run through vision OCR, to keep cost and
# latency bounded on large documents.
MAX_PDF_OCR_PAGES = 5


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
        model="qwen/qwen3.6-27b",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract ALL text from this image exactly as written. Include every word, number, date, name, address, and detail. Return only the extracted text, nothing else."},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        temperature=0,
        max_tokens=4000,
        reasoning_effort="none",
    )

    text = response.choices[0].message.content.strip()
    return text if text else "No text found in image"


def _extract_from_pdf(pdf_bytes: bytes) -> str:
    # 1. Fast path: PDFs that already have a real text layer (digital lab reports,
    #    e-prescriptions). pdfminer reads that text directly — no AI needed.
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        text = pdfminer_extract(io.BytesIO(pdf_bytes))
        if text and len(text.strip()) >= 40:
            return text.strip()
    except Exception:
        pass

    # 2. Fallback for scanned / photo PDFs (no text layer): render each page to an
    #    image and run it through the same vision OCR model used for images.
    #    Best-effort — requires PyMuPDF; if it's unavailable we degrade to the
    #    original guidance instead of crashing.
    try:
        import fitz  # PyMuPDF
    except Exception:
        return "PDF text extraction failed. Try uploading the document as an image instead."

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return "This PDF could not be opened. Try uploading the document as an image instead."

    page_texts = []
    for page in doc[:MAX_PDF_OCR_PAGES]:
        try:
            pix = page.get_pixmap(dpi=200)
            page_texts.append(_extract_from_image(pix.tobytes("png")))
        except Exception as e:
            page_texts.append(f"(page skipped: {e})")
    doc.close()

    combined = "\n\n".join(
        t for t in page_texts if t and not t.startswith("OCR failed") and not t.startswith("(page skipped")
    )
    return combined.strip() or "No readable text found in this PDF."
