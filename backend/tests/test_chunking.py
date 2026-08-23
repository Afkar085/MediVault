"""Passages must be small enough to retrieve and whole enough to be readable."""
from app.services.chunking import (
    MAX_CHUNKS_PER_DOCUMENT,
    MIN_CHUNK_CHARS,
    TARGET_CHARS,
    chunk_document,
)

PRESCRIPTION = """Dr. S. Kumar, MS Ortho
Kasturba Medical College Hospital, Manipal
14/06/2026

Diagnosis: Osteoarthritis, right knee

Rx:
1. Paracetamol 650mg - 1 tablet twice daily after food - 5 days
2. Methylprednisolone 40mg - single intra-articular injection

Advice: physiotherapy three times a week. Review after one month.
"""

LAB_REPORT = """COMPLETE BLOOD COUNT

Haemoglobin        9.2 g/dL      (13.0 - 17.0)
Total WBC          7400 /cumm    (4000 - 11000)
Platelet count     2.4 lakh      (1.5 - 4.5)

IMPRESSION: Mild anaemia. Suggest iron studies.
"""


def test_an_empty_document_produces_nothing():
    assert chunk_document("") == []
    assert chunk_document("   \n  ") == []


def test_a_short_document_stays_in_one_piece():
    chunks = chunk_document(PRESCRIPTION)
    assert len(chunks) == 1
    assert "Paracetamol 650mg" in chunks[0]


def test_a_lab_value_and_its_reference_range_stay_together():
    """Splitting these apart would make the passage unanswerable."""
    chunk = next(c for c in chunk_document(LAB_REPORT) if "Haemoglobin" in c)
    assert "9.2 g/dL" in chunk
    assert "13.0 - 17.0" in chunk


def test_a_long_document_is_split_into_readable_passages():
    long_text = "\n\n".join(f"Visit {i}. " + ("clinical detail " * 30) for i in range(12))
    chunks = chunk_document(long_text)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= TARGET_CHARS + 200  # allow the overlap tail
        assert len(chunk) >= MIN_CHUNK_CHARS


def test_consecutive_passages_overlap_so_context_is_not_cut_in_half():
    long_text = "\n\n".join(f"Paragraph number {i} with some clinical text in it." for i in range(40))
    chunks = chunk_document(long_text)
    assert len(chunks) > 1
    tail = chunks[0][-40:]
    assert tail.strip() and tail.strip()[:20] in chunks[1]


def test_page_breaks_from_a_multi_page_upload_are_boundaries():
    text = "Page one content about the knee.\n\n--- Page Break ---\n\nPage two content about medication."
    chunks = chunk_document(text)
    joined = " ".join(chunks)
    assert "Page Break" not in joined
    assert "knee" in joined and "medication" in joined


def test_ocr_text_with_no_punctuation_is_still_split():
    """Scanned output often arrives as one unbroken run of words."""
    runon = "word " * 1000
    chunks = chunk_document(runon)
    assert len(chunks) > 1
    assert all(len(c) <= TARGET_CHARS + 200 for c in chunks)


def test_a_pathological_document_cannot_flood_the_index():
    chunks = chunk_document("\n\n".join("paragraph " * 40 for _ in range(500)))
    assert len(chunks) <= MAX_CHUNKS_PER_DOCUMENT


def test_a_document_shorter_than_the_minimum_is_still_kept():
    """Better one tiny passage than silently indexing nothing."""
    assert chunk_document("BP 140/90") == ["BP 140/90"]


def test_passages_are_returned_in_document_order():
    text = "\n\n".join(f"Section {i} " + ("filler " * 60) for i in range(6))
    chunks = chunk_document(text)
    positions = [text.index(c[:30].strip()) for c in chunks if c[:30].strip() in text]
    assert positions == sorted(positions)
