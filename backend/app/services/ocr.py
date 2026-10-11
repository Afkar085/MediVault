"""Reading the text off a scanned document.

Every function here returns the document's text, or an empty string if it could
not be read. It never returns an explanation as if it were the text: that string
would be stored as raw_ocr_text, shown to the user as their prescription, and
indexed as a retrievable passage, so the assistant could end up quoting an
exception message back as if it came from a medical record.
"""
import base64
import io

from groq import Groq

from app.config import settings
from app.logger import logger

VISION_MODEL = "qwen/qwen3.6-27b"

# A vision call on a large scan is slow but not unbounded. Without a timeout a
# stalled request holds the background worker open indefinitely.
client = Groq(api_key=settings.GROQ_API_KEY, timeout=90.0, max_retries=1)

_PROMPT = (
    "Extract ALL text from this image exactly as written. Include every word, "
    "number, date, name, address, and detail. Return only the extracted text, "
    "nothing else."
)


def extract_text_from_bytes(file_bytes: bytes, content_type: str = "") -> str:
    """The document's text, or "" if it could not be read."""
    try:
        if content_type == "application/pdf" or file_bytes[:4] == b"%PDF":
            return _extract_from_pdf(file_bytes)
        return _extract_from_image(file_bytes)
    except Exception as e:
        logger.warning("Could not read document (%s): %s", content_type or "image", e)
        return ""


def _image_mime(image_bytes: bytes) -> str:
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:4] == b"RIFF":
        return "image/webp"
    return "image/jpeg"


# Each image costs a fixed number of input tokens whatever its size, so pixels
# beyond this only make the request slower to send. Large enough for small print.
MAX_OCR_EDGE = 2400


def prepare_image(image_bytes: bytes) -> bytes:
    """The image as the model should see it: upright, and not needlessly huge.

    Phone cameras store most photos sideways with an EXIF flag saying which way
    is up. Viewers honour the flag; the model receives raw pixels, so a portrait
    prescription arrived rotated 90 degrees. Applied only to what is sent for
    reading: the stored original is never modified. If Pillow is unavailable or
    the image cannot be decoded, the bytes are sent as they are.
    """
    try:
        from PIL import Image, ImageOps
    except ImportError:  # pragma: no cover - optional at runtime
        return image_bytes
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            orientation = (img.getexif() or {}).get(0x0112, 1)
            too_big = max(img.size) > MAX_OCR_EDGE
            if orientation in (None, 1) and not too_big:
                return image_bytes
            img = ImageOps.exif_transpose(img)
            if too_big:
                img.thumbnail((MAX_OCR_EDGE, MAX_OCR_EDGE))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=90)
            return out.getvalue()
    except Exception as e:
        logger.info("Image sent unprepared (%s)", type(e).__name__)
        return image_bytes


def _extract_from_image(image_bytes: bytes) -> str:
    image_bytes = prepare_image(image_bytes)
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    response = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": _PROMPT},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{_image_mime(image_bytes)};base64,{b64}"},
                },
            ],
        }],
        temperature=0,
        max_tokens=2000,
        reasoning_effort="none",
    )

    content = response.choices[0].message.content or ""
    text = content.strip()
    if not text:
        logger.info("Vision model found no text in the image")
    return text


def _extract_from_pdf(pdf_bytes: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract

        text = pdfminer_extract(io.BytesIO(pdf_bytes))
    except Exception as e:
        logger.warning("PDF text extraction failed: %s", e)
        return ""

    if text and text.strip():
        return text.strip()

    # A PDF that is just a photo of a page has no embedded text layer. Reading
    # it would mean rasterising the pages first, which this pipeline does not do.
    logger.info("PDF has no extractable text layer")
    return ""
