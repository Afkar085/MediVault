import base64
import io
import json
import httpx
from app.config import settings


def extract_text_from_bytes(file_bytes: bytes, content_type: str = "") -> str:
    try:
        if content_type == "application/pdf" or file_bytes[:4] == b"%PDF":
            return _extract_from_pdf(file_bytes)
        return _extract_from_image(file_bytes)
    except Exception as e:
        return f"OCR failed: {str(e)}"


def _call_vision_api(image_bytes: bytes) -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    url = f"https://vision.googleapis.com/v1/images:annotate?key={settings.GOOGLE_VISION_KEY}"
    payload = {
        "requests": [{
            "image": {"content": b64},
            "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
        }]
    }
    resp = httpx.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    annotations = data.get("responses", [{}])[0].get("textAnnotations", [])
    if annotations:
        return annotations[0].get("description", "").strip()
    return "No text found in image"


def _extract_from_image(image_bytes: bytes) -> str:
    if getattr(settings, "GOOGLE_VISION_KEY", None):
        return _call_vision_api(image_bytes)
    return _fallback_ocr(image_bytes)


def _extract_from_pdf(pdf_bytes: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        text = pdfminer_extract(io.BytesIO(pdf_bytes))
        if text and text.strip():
            return text.strip()
    except Exception:
        pass

    if getattr(settings, "GOOGLE_VISION_KEY", None):
        try:
            from PIL import Image
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(pdf_bytes, dpi=200)
            all_text = []
            for page_img in pages:
                buf = io.BytesIO()
                page_img.save(buf, format="PNG")
                text = _call_vision_api(buf.getvalue())
                if text and text != "No text found in image":
                    all_text.append(text)
            return "\n\n".join(all_text) if all_text else "No text found in PDF"
        except ImportError:
            pass

    return "PDF OCR requires Google Vision API key or pdf2image+poppler"


def _fallback_ocr(image_bytes: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        text = pytesseract.image_to_string(image)
        return text.strip() if text.strip() else "No text found in image"
    except Exception as e:
        return f"OCR failed: {str(e)}"
