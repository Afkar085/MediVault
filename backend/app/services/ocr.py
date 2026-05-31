import pytesseract
import io
from PIL import Image


def extract_text_from_bytes(file_bytes: bytes, content_type: str = "") -> str:
    """
    Extract text from image bytes or PDF bytes.
    Handles: JPEG, PNG, WEBP, GIF, BMP, and PDF.
    """
    try:
        # --- PDF path ---
        if content_type == "application/pdf" or file_bytes[:4] == b"%PDF":
            return _extract_from_pdf(file_bytes)

        # --- Image path ---
        return _extract_from_image(file_bytes)

    except Exception as e:
        return f"OCR failed: {str(e)}"


def _extract_from_image(image_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    text = pytesseract.image_to_string(image)
    return text.strip() if text.strip() else "No text found in image"


def _extract_from_pdf(pdf_bytes: bytes) -> str:
    """
    Convert each PDF page to an image and run OCR.
    Uses pdf2image (poppler) which is production-safe and doesn't require
    a display. Falls back to pdfminer for text-layer PDFs (faster, no OCR needed).
    """
    # Try text-layer extraction first (fast, no OCR needed)
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        import io as _io
        text = pdfminer_extract(_io.BytesIO(pdf_bytes))
        if text and text.strip():
            return text.strip()
    except Exception:
        pass

    # Fall back to page-rasterization + OCR (scanned PDFs)
    try:
        from pdf2image import convert_from_bytes
        pages = convert_from_bytes(pdf_bytes, dpi=200)
        all_text = []
        for page_img in pages:
            page_text = pytesseract.image_to_string(page_img)
            if page_text.strip():
                all_text.append(page_text.strip())
        combined = "\n\n".join(all_text)
        return combined if combined else "No text found in PDF"
    except ImportError:
        # pdf2image/poppler not installed — last resort: single-page attempt
        return "PDF text extraction requires pdf2image. Install: pip install pdf2image"
    except Exception as e:
        return f"PDF OCR failed: {str(e)}"
