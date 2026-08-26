"""A document that could not be read must come back empty, never explained.

An explanation returned as text gets stored as raw_ocr_text, shown to the user
as their prescription, and indexed as a retrievable passage, so the assistant
could quote it back as if it were something a doctor wrote.
"""
from types import SimpleNamespace

import pytest

from app.services import ocr

PNG_HEADER = b"\x89PNG\r\n\x1a\n"
JPEG = b"\xff\xd8\xff" + b"body"
PDF = b"%PDF-1.4 body"


def reply(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.fixture
def vision(monkeypatch):
    def install(result):
        def create(**kwargs):
            if isinstance(result, Exception):
                raise result
            create.kwargs = kwargs
            return reply(result)
        monkeypatch.setattr(ocr.client.chat.completions, "create", create)
        return create
    return install


# --- failures come back empty ------------------------------------------------

def test_a_vision_failure_returns_nothing_not_an_error_message(vision):
    vision(RuntimeError("connection reset by peer"))
    assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == ""


def test_an_image_with_no_text_returns_nothing(vision):
    vision("   ")
    assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == ""


def test_a_null_completion_does_not_crash(vision):
    vision(None)
    assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == ""


def test_a_pdf_with_no_text_layer_returns_nothing():
    # pdfminer finds nothing in these bytes; the old code returned advice text.
    assert ocr.extract_text_from_bytes(PDF, "application/pdf") == ""


def test_no_failure_path_leaks_words_into_the_document_text(vision):
    """Whatever went wrong, the result must be empty rather than prose."""
    for failure in [RuntimeError("boom"), "", "  \n "]:
        vision(failure)
        assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == ""
    assert ocr.extract_text_from_bytes(PDF, "application/pdf") == ""


# --- success still works -----------------------------------------------------

def test_text_is_returned_stripped(vision):
    vision("  Dr Kumar\nParacetamol 650mg  ")
    assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == "Dr Kumar\nParacetamol 650mg"


def test_a_pdf_is_routed_by_its_magic_bytes_even_without_a_content_type(vision):
    called = vision("should not be used")
    ocr.extract_text_from_bytes(PDF)
    assert not hasattr(called, "kwargs")  # the vision model was never called


def test_the_image_mime_type_matches_the_actual_bytes(vision):
    create = vision("text")

    ocr.extract_text_from_bytes(PNG_HEADER + b"rest", "image/png")
    assert "data:image/png;base64," in create.kwargs["messages"][0]["content"][1]["image_url"]["url"]

    ocr.extract_text_from_bytes(b"RIFF____WEBP", "image/webp")
    assert "data:image/webp;base64," in create.kwargs["messages"][0]["content"][1]["image_url"]["url"]

    ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    assert "data:image/jpeg;base64," in create.kwargs["messages"][0]["content"][1]["image_url"]["url"]
