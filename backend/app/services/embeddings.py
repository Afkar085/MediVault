"""Local text embeddings for semantic search (no extra API key / cost).

Uses fastembed (ONNX) with BAAI/bge-small-en-v1.5 -> 384-dim vectors. The model
is loaded lazily on first use and cached. Every function degrades gracefully:
if the model can't be loaded, callers get ``None`` and fall back to keyword-only
behaviour, so the app never hard-fails because of the semantic layer.
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 384
_MODEL_NAME = "BAAI/bge-small-en-v1.5"

_model = None
_model_failed = False


def _get_model():
    """Lazily load and cache the embedding model. Returns None if unavailable."""
    global _model, _model_failed
    if _model is not None or _model_failed:
        return _model
    try:
        from fastembed import TextEmbedding

        _model = TextEmbedding(model_name=_MODEL_NAME)
        logger.info("Loaded embedding model %s", _MODEL_NAME)
    except Exception as e:  # pragma: no cover - environment dependent
        _model_failed = True
        logger.error("Embedding model unavailable, semantic features off: %s", e)
    return _model


def embed_text(text: str) -> Optional[List[float]]:
    """Embed a string into a 384-dim vector, or None if unavailable/empty."""
    if not text or not text.strip():
        return None
    model = _get_model()
    if model is None:
        return None
    try:
        vector = next(iter(model.embed([text])))
        return vector.tolist()
    except Exception as e:  # pragma: no cover - defensive
        logger.error("Embedding failed: %s", e)
        return None


def build_record_text(record: dict, medicines: Optional[list] = None) -> str:
    """Compose the text representation of a record used for embedding/retrieval."""
    parts = []
    for field in (
        "document_type",
        "doctor_name",
        "hospital_name",
        "specialty",
        "diagnosis",
        "recommendations",
    ):
        value = record.get(field)
        if value:
            parts.append(str(value))

    meds = medicines if medicines is not None else (record.get("medicines") or [])
    med_names = [m.get("name") for m in meds if m.get("name")]
    if med_names:
        parts.append("Medicines: " + ", ".join(med_names))

    ocr = record.get("raw_ocr_text")
    if ocr:
        parts.append(str(ocr)[:2000])  # cap to keep embedding input bounded

    return "\n".join(parts).strip()
