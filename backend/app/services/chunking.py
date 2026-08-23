"""Split a document's scanned text into passages that can be retrieved.

A record is embedded as a single vector built from its first 2000 characters,
which is fine for "find the knee prescription" and useless for "what was the
haemoglobin value" — the number is on page three and the model never sees the
text anyway. Passages fix both halves: they are small enough to embed
meaningfully, and small enough to put in front of the model verbatim.

Chunking is done on natural boundaries (blank lines, then line breaks, then
sentences) so a passage rarely cuts through a lab value or a dosage line.
"""
import re
from typing import List

# ~600 characters is roughly a paragraph of a prescription or a block of lab
# values: enough context to be meaningful, small enough that eight of them fit
# in a prompt without crowding out the answer.
TARGET_CHARS = 600
OVERLAP_CHARS = 120
MIN_CHUNK_CHARS = 40
MAX_CHUNKS_PER_DOCUMENT = 40

# Page markers inserted by the upload pipeline when several images are combined.
_PAGE_BREAK = re.compile(r"\n*-{2,}\s*Page Break\s*-{2,}\n*", re.IGNORECASE)
_PARAGRAPH = re.compile(r"\n\s*\n")
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def _split_long(text: str) -> List[str]:
    """Break a too-long block on sentence boundaries, then hard-wrap what's left."""
    pieces: List[str] = []
    buffer = ""
    for sentence in _SENTENCE.split(text):
        if len(buffer) + len(sentence) + 1 <= TARGET_CHARS:
            buffer = f"{buffer} {sentence}".strip()
            continue
        if buffer:
            pieces.append(buffer)
        # A single "sentence" can still be longer than the target (OCR output
        # often has no punctuation at all), so hard-wrap it.
        while len(sentence) > TARGET_CHARS:
            pieces.append(sentence[:TARGET_CHARS])
            sentence = sentence[TARGET_CHARS - OVERLAP_CHARS:]
        buffer = sentence
    if buffer:
        pieces.append(buffer)
    return pieces


def _blocks(text: str) -> List[str]:
    """Natural units of the document, largest boundary first."""
    units: List[str] = []
    for page in _PAGE_BREAK.split(text):
        for paragraph in _PARAGRAPH.split(page):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            if len(paragraph) <= TARGET_CHARS:
                units.append(paragraph)
            else:
                units.extend(_split_long(paragraph))
    return units


def chunk_document(text: str) -> List[str]:
    """Passages of roughly TARGET_CHARS, in document order, with slight overlap.

    Overlap matters: a dosage and the medicine it belongs to must not end up in
    two different passages with no way to see them together.
    """
    if not text or not text.strip():
        return []

    chunks: List[str] = []
    current = ""
    for block in _blocks(text):
        if not current:
            current = block
        elif len(current) + len(block) + 1 <= TARGET_CHARS:
            current = f"{current}\n{block}"
        else:
            chunks.append(current)
            tail = current[-OVERLAP_CHARS:] if len(current) > OVERLAP_CHARS else ""
            current = f"{tail}\n{block}".strip() if tail else block
        if len(chunks) >= MAX_CHUNKS_PER_DOCUMENT:
            break

    if current and len(chunks) < MAX_CHUNKS_PER_DOCUMENT:
        chunks.append(current)

    # A trailing fragment with nothing in it is noise in the index.
    return [c.strip() for c in chunks if len(c.strip()) >= MIN_CHUNK_CHARS] or [text.strip()[:TARGET_CHARS]]
