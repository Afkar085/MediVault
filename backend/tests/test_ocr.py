"""Reading a document: an empty result and a broken service are not the same.

Two rules together:

* Nothing an error produces may ever come back AS the text. An explanation
  returned as text gets stored as raw_ocr_text, shown to the user as their
  prescription, and indexed as a retrievable passage, so the assistant could
  quote it back as if it were something a doctor wrote.
* A service that could not be reached must say so (OcrUnavailable) rather than
  returning "". Returning "" for both is what made a perfectly clear
  prescription report itself as unreadable when Groq retired the vision model.
"""
from types import SimpleNamespace

import pytest

from app.services import ocr
from app.services.ocr import OcrUnavailable

PNG_HEADER = b"\x89PNG\r\n\x1a\n"
JPEG = b"\xff\xd8\xff" + b"body"
PDF = b"%PDF-1.4 body"


def reply(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.fixture(autouse=True)
def _no_waiting(monkeypatch):
    """Backoff between retries is real seconds in production, not in tests."""
    monkeypatch.setattr(ocr.time, "sleep", lambda _s: None)


@pytest.fixture(autouse=True)
def _forget_working_model(monkeypatch):
    """Which model worked is remembered per process; tests must not inherit it."""
    monkeypatch.setattr(ocr, "_working_model", None)


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


# --- failures are raised, never returned as text -----------------------------

def test_a_vision_failure_is_raised_not_returned_as_the_document_text(vision):
    vision(RuntimeError("connection reset by peer"))
    with pytest.raises(OcrUnavailable):
        ocr.extract_text_from_bytes(JPEG, "image/jpeg")


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
    """Whatever went wrong, nothing comes back AS the document's text."""
    vision(RuntimeError("boom"))
    with pytest.raises(OcrUnavailable) as raised:
        ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    # Not even the upstream message: it would end up in a medical record.
    assert "boom" not in str(raised.value)

    for empty in ["", "  \n ", None]:
        vision(empty)
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


# --- surviving a retired model ----------------------------------------------
#
# Groq has retired this app's vision model three times. The last time
# (qwen/qwen3.6-27b, shut down 2026-09-14) every upload failed and the app
# told people their documents were unreadable. A retirement must cost one
# failed call, not every call.

class _ApiError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


@pytest.fixture
def by_model(monkeypatch):
    """Let each model id behave differently, and record what was called."""
    def install(behaviour):
        calls = []

        def create(**kwargs):
            model = kwargs["model"]
            calls.append(model)
            outcome = behaviour.get(model, _ApiError("model_not_found", 404))
            if isinstance(outcome, Exception):
                raise outcome
            return reply(outcome)

        monkeypatch.setattr(ocr.client.chat.completions, "create", create)
        return calls
    return install


def test_a_retired_model_falls_through_to_one_that_works(by_model, monkeypatch):
    monkeypatch.setattr(ocr.settings, "GROQ_VISION_MODEL", "gone/retired-model")
    monkeypatch.setattr(ocr, "FALLBACK_VISION_MODELS", ("live/model",))
    calls = by_model({"live/model": "Dr Nambiar\nAzithromycin 500mg"})

    assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == "Dr Nambiar\nAzithromycin 500mg"
    assert calls == ["gone/retired-model", "live/model"]  # retired one tried once only


def test_a_retired_model_is_not_tried_again_on_the_next_page(by_model, monkeypatch):
    monkeypatch.setattr(ocr.settings, "GROQ_VISION_MODEL", "gone/retired-model")
    monkeypatch.setattr(ocr, "FALLBACK_VISION_MODELS", ("live/model",))
    calls = by_model({"live/model": "page text"})

    ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    ocr.extract_text_from_bytes(JPEG, "image/jpeg")

    # The second page goes straight to the model that worked.
    assert calls == ["gone/retired-model", "live/model", "live/model"]


def test_a_missing_model_is_not_retried_with_backoff(by_model, monkeypatch):
    """A retired id will never start working; only another model can help."""
    monkeypatch.setattr(ocr.settings, "GROQ_VISION_MODEL", "gone/a")
    monkeypatch.setattr(ocr, "FALLBACK_VISION_MODELS", ("gone/b",))
    calls = by_model({})

    with pytest.raises(OcrUnavailable):
        ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    assert calls == ["gone/a", "gone/b"]  # one attempt each, not MAX_ATTEMPTS


def test_every_model_being_gone_is_a_service_failure_not_a_blank_document(by_model, monkeypatch):
    monkeypatch.setattr(ocr.settings, "GROQ_VISION_MODEL", "gone/a")
    monkeypatch.setattr(ocr, "FALLBACK_VISION_MODELS", ("gone/b",))
    by_model({})

    with pytest.raises(OcrUnavailable):
        ocr.extract_text_from_bytes(JPEG, "image/jpeg")


# --- transient failures ------------------------------------------------------

def test_a_rate_limit_is_waited_out_rather_than_failing_the_document(monkeypatch):
    attempts = {"n": 0}

    def create(**_kwargs):
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise _ApiError("rate limit reached", 429)
        return reply("the prescription text")

    monkeypatch.setattr(ocr.client.chat.completions, "create", create)
    assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == "the prescription text"
    assert attempts["n"] == 3


def test_retries_are_bounded(monkeypatch):
    attempts = {"n": 0}

    def create(**_kwargs):
        attempts["n"] += 1
        raise _ApiError("service unavailable", 503)

    monkeypatch.setattr(ocr.client.chat.completions, "create", create)
    monkeypatch.setattr(ocr, "FALLBACK_VISION_MODELS", ())

    with pytest.raises(OcrUnavailable):
        ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    assert attempts["n"] == ocr.MAX_ATTEMPTS


def test_a_bad_api_key_is_not_blamed_on_the_model(monkeypatch):
    """No other model will help, so the fallback list must not be walked."""
    calls = []

    def create(**kwargs):
        calls.append(kwargs["model"])
        raise _ApiError("invalid api key", 401)

    monkeypatch.setattr(ocr.client.chat.completions, "create", create)
    monkeypatch.setattr(ocr.settings, "GROQ_VISION_MODEL", "a/model")
    monkeypatch.setattr(ocr, "FALLBACK_VISION_MODELS", ("b/model",))

    with pytest.raises(OcrUnavailable):
        ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    assert calls == ["a/model", "b/model"]  # one attempt each, no backoff loop


# --- which models are tried --------------------------------------------------

def test_the_configured_model_is_tried_first(monkeypatch):
    monkeypatch.setattr(ocr.settings, "GROQ_VISION_MODEL", "configured/model")
    assert ocr.vision_models()[0] == "configured/model"


def test_the_model_list_has_no_repeats(monkeypatch):
    monkeypatch.setattr(ocr.settings, "GROQ_VISION_MODEL", ocr.FALLBACK_VISION_MODELS[0])
    assert len(ocr.vision_models()) == len(set(ocr.vision_models()))


# --- a model that will not take reasoning_effort -----------------------------

def test_a_model_that_rejects_reasoning_effort_is_asked_again_without_it(monkeypatch):
    """Dropping the parameter must not be mistaken for the model being gone:
    that would skip a perfectly good model and fail the document."""
    monkeypatch.setattr(ocr, "_plain_models", set())
    seen = []

    def create(**kwargs):
        seen.append("reasoning_effort" in kwargs)
        if "reasoning_effort" in kwargs:
            raise _ApiError("unsupported parameter: reasoning_effort", 400)
        return reply("the prescription text")

    monkeypatch.setattr(ocr.client.chat.completions, "create", create)
    assert ocr.extract_text_from_bytes(JPEG, "image/jpeg") == "the prescription text"
    assert seen == [True, False]


def test_the_parameter_is_dropped_for_later_pages_too(monkeypatch):
    monkeypatch.setattr(ocr, "_plain_models", set())
    seen = []

    def create(**kwargs):
        seen.append("reasoning_effort" in kwargs)
        if "reasoning_effort" in kwargs:
            raise _ApiError("unsupported parameter: reasoning_effort", 400)
        return reply("text")

    monkeypatch.setattr(ocr.client.chat.completions, "create", create)
    ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    ocr.extract_text_from_bytes(JPEG, "image/jpeg")

    assert seen == [True, False, False]


def test_an_unrelated_400_is_still_a_model_problem(monkeypatch):
    monkeypatch.setattr(ocr, "_plain_models", set())
    monkeypatch.setattr(ocr, "FALLBACK_VISION_MODELS", ())
    calls = []

    def create(**_kwargs):
        calls.append(1)
        raise _ApiError("model_not_found", 404)

    monkeypatch.setattr(ocr.client.chat.completions, "create", create)
    with pytest.raises(OcrUnavailable):
        ocr.extract_text_from_bytes(JPEG, "image/jpeg")
    assert len(calls) == 1
