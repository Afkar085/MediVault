"""Reading the text off a scanned document.

Two outcomes, and keeping them apart is the point of this module:

* the document was read, and the text is returned (``""`` when the image
  genuinely has no text on it, e.g. a dark blurry photo);
* the reading *service* could not be reached, which raises ``OcrUnavailable``.

Collapsing those two into "no text" is what made a perfectly clear prescription
come back as "couldn't be read". On 2026-09-14 Groq retired the vision model
this app was pinned to; every call failed instantly, the exception was
swallowed into an empty string, and the record was marked failed, so the app
told people their document was unreadable when nothing had been read at all.

Nothing here ever returns an explanation as if it were the text: that string
would be stored as raw_ocr_text, shown to the user as their prescription, and
indexed as a retrievable passage, so the assistant could end up quoting an
exception message back as if it came from a medical record.
"""
import base64
import io
import random
import threading
import time

from groq import Groq

from app.config import settings
from app.logger import logger


class OcrUnavailable(RuntimeError):
    """The reading service failed. Says nothing about the document itself."""


# The configured model first, then known-good alternates. A retired model is
# the single most common way this breaks (three times so far), and when it
# happens every upload fails with a document that is perfectly readable. The
# working one is remembered for the life of the process, so the cost of a
# retirement is one failed call rather than one per page forever.
FALLBACK_VISION_MODELS = ("qwen/qwen3.8-27b", "meta-llama/llama-4-scout-17b-16e-instruct")

# A vision call on a large scan is slow but not unbounded. Without a timeout a
# stalled request holds the background worker open indefinitely.
client = Groq(api_key=settings.GROQ_API_KEY, timeout=90.0, max_retries=1)

_PROMPT = (
    "Extract ALL text from this image exactly as written. Include every word, "
    "number, date, name, address, and detail. Return only the extracted text, "
    "nothing else."
)

# A transient failure (rate limit, gateway error, a dropped connection) is
# worth waiting out: the alternative is telling someone their prescription is
# unreadable because the service was busy for two seconds.
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = (1.5, 4.0)

_model_lock = threading.Lock()
_working_model = None


def vision_models() -> list:
    """The models to try, configured one first, without repeats."""
    ordered = [settings.GROQ_VISION_MODEL, *FALLBACK_VISION_MODELS]
    return list(dict.fromkeys(m for m in ordered if m))


def _preferred_models() -> list:
    """Try the model that worked last time first; it almost always still works."""
    with _model_lock:
        known = _working_model
    models = vision_models()
    if known and known in models:
        models.remove(known)
        return [known, *models]
    return models


def _remember_model(model: str) -> None:
    global _working_model
    with _model_lock:
        if _working_model != model:
            if _working_model is not None or model != vision_models()[0]:
                logger.info("Vision model in use: %s", model)
            _working_model = model


def _is_missing_model(error: Exception) -> bool:
    """Whether this error means "that model is not available", not "try again".

    A retired or misspelled model is permanent for that id, so the next one in
    the list is tried immediately rather than after a backoff.
    """
    status = getattr(error, "status_code", None)
    if status in (401, 403):
        return False  # a key problem; no other model will help
    message = str(error).lower()
    return (
        status in (400, 404)
        or "model_not_found" in message
        or "does not exist" in message
        or "decommissioned" in message
        or "deprecated" in message
        or "has been removed" in message
    )


def _is_retryable(error: Exception) -> bool:
    status = getattr(error, "status_code", None)
    if status == 429 or (isinstance(status, int) and status >= 500):
        return True
    message = str(error).lower()
    return any(word in message for word in ("timeout", "timed out", "connection", "temporarily"))


def extract_text_from_bytes(file_bytes: bytes, content_type: str = "") -> str:
    """The document's text, or "" if the document genuinely has none.

    Raises OcrUnavailable if the document could not be read because the service
    failed, so the caller can tell "we read it and there was nothing" apart
    from "we never managed to look".
    """
    started = time.monotonic()
    is_pdf = content_type == "application/pdf" or file_bytes[:4] == b"%PDF"
    text = _extract_from_pdf(file_bytes) if is_pdf else _extract_from_image(file_bytes)
    logger.info(
        "OCR %s: %d characters in %.2fs",
        "pdf" if is_pdf else "image", len(text), time.monotonic() - started,
    )
    return text


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


# reasoning_effort saves several seconds per page on models that support it,
# and is a 400 on models that do not. Which is which is learned from the first
# refusal rather than hardcoded, so swapping models never needs a code change.
_plain_models = set()


def _is_bad_parameter(error: Exception) -> bool:
    message = str(error).lower()
    return "reasoning_effort" in message or (
        getattr(error, "status_code", None) == 400
        and any(w in message for w in ("unsupported", "unrecognized", "not supported", "invalid value"))
    )


def _vision_call(model: str, data_url: str) -> str:
    kwargs = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": _PROMPT},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }],
        "temperature": 0,
        "max_tokens": 2000,
    }
    if model not in _plain_models:
        kwargs["reasoning_effort"] = "none"

    try:
        response = client.chat.completions.create(**kwargs)
    except Exception as e:
        if "reasoning_effort" not in kwargs or not _is_bad_parameter(e):
            raise
        logger.info("%s does not take reasoning_effort; asking without it", model)
        _plain_models.add(model)
        kwargs.pop("reasoning_effort")
        response = client.chat.completions.create(**kwargs)
    return (response.choices[0].message.content or "").strip()


def _extract_from_image(image_bytes: bytes) -> str:
    prepared = prepare_image(image_bytes)
    if prepared is not image_bytes:
        logger.info("Image prepared for reading: %d -> %d bytes", len(image_bytes), len(prepared))
    data_url = f"data:{_image_mime(prepared)};base64,{base64.b64encode(prepared).decode('utf-8')}"

    last_error = None
    for model in _preferred_models():
        for attempt in range(1, MAX_ATTEMPTS + 1):
            started = time.monotonic()
            try:
                text = _vision_call(model, data_url)
            except Exception as e:
                last_error = e
                took = time.monotonic() - started
                if _is_missing_model(e):
                    logger.warning(
                        "Vision model %s is unavailable (%.2fs): %s", model, took, str(e)[:200]
                    )
                    break  # a different model is the only thing that can help
                if attempt < MAX_ATTEMPTS and _is_retryable(e):
                    delay = BACKOFF_SECONDS[min(attempt - 1, len(BACKOFF_SECONDS) - 1)]
                    delay += random.uniform(0, 0.5)  # spread out concurrent pages
                    logger.info(
                        "Vision call failed (%s, attempt %d/%d, %.2fs); retrying in %.1fs",
                        type(e).__name__, attempt, MAX_ATTEMPTS, took, delay,
                    )
                    time.sleep(delay)
                    continue
                logger.warning(
                    "Vision call failed on %s after %d attempt(s), %.2fs: %s",
                    model, attempt, took, str(e)[:200],
                )
                break
            else:
                _remember_model(model)
                logger.info("Vision call on %s took %.2fs", model, time.monotonic() - started)
                if not text:
                    logger.info("Vision model found no text in the image")
                return text

    raise OcrUnavailable(
        f"no vision model could read the image (tried {', '.join(_preferred_models())}): "
        f"{type(last_error).__name__ if last_error else 'unknown'}"
    )


def _extract_from_pdf(pdf_bytes: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract

        text = pdfminer_extract(io.BytesIO(pdf_bytes))
    except Exception as e:
        logger.warning("PDF text extraction failed: %s", e)
        text = ""

    if text and text.strip():
        return text.strip()

    # A PDF that is just a photo of a page has no embedded text layer. Render
    # the first pages and read them as images rather than giving up: a scanned
    # prescription saved as a PDF is a document the app should still read.
    pages = _render_pdf_pages(pdf_bytes)
    if not pages:
        logger.info("PDF has no extractable text layer and could not be rendered")
        return ""
    texts = [_extract_from_image(page) for page in pages]
    return "\n\n".join(t for t in texts if t.strip())


# Rendering is only worth doing for the pages someone would actually have
# photographed; a 200-page PDF is not a prescription.
MAX_PDF_PAGES_RENDERED = 5


def _render_pdf_pages(pdf_bytes: bytes) -> list:
    """Page images for a PDF with no text layer, or [] if it cannot be rendered."""
    try:
        import pypdfium2
    except ImportError:
        return []
    try:
        pdf = pypdfium2.PdfDocument(pdf_bytes)
        images = []
        for index in range(min(len(pdf), MAX_PDF_PAGES_RENDERED)):
            bitmap = pdf[index].render(scale=2)
            buffer = io.BytesIO()
            bitmap.to_pil().save(buffer, format="JPEG", quality=90)
            images.append(buffer.getvalue())
        return images
    except Exception as e:
        logger.info("Could not render PDF pages (%s)", type(e).__name__)
        return []
