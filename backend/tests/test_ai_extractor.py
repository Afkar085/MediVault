"""Tests for the extraction JSON parsing (Groq client mocked, no network)."""
from types import SimpleNamespace

import pytest

import app.services.ai_extractor as ai
import app.services.ai_extractor as ai_extractor


def _fake_response(content: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


def test_parses_plain_json(mocker):
    mocker.patch.object(
        ai.client.chat.completions,
        "create",
        return_value=_fake_response('{"doctor_name": "Dr. Rao", "medicines": []}'),
    )
    result = ai.extract_medical_data("some ocr text")
    assert result["doctor_name"] == "Dr. Rao"


def test_parses_fenced_json(mocker):
    fenced = '```json\n{"diagnosis": "flu"}\n```'
    mocker.patch.object(
        ai.client.chat.completions, "create", return_value=_fake_response(fenced)
    )
    result = ai.extract_medical_data("ocr")
    assert result["diagnosis"] == "flu"


def test_bad_json_returns_empty_dict_and_logs(mocker, caplog):
    mocker.patch.object(
        ai.client.chat.completions,
        "create",
        return_value=_fake_response("this is not json at all"),
    )
    result = ai.extract_medical_data("ocr")
    assert result == {}
    assert "Failed to parse extraction JSON" in caplog.text


# --- an empty completion must not condemn the whole document -----------------

def test_an_empty_response_yields_no_fields_rather_than_raising(mocker):
    """A reasoning model can return an empty content channel. That means we got
    no structured fields, not that the document is unreadable."""
    mocker.patch.object(
        ai.client.chat.completions, "create",
        return_value=_fake_response(""),
    )
    assert ai.extract_medical_data("Dr Kumar, Paracetamol 650mg") == {}


def test_a_null_content_channel_is_handled(mocker):
    mocker.patch.object(
        ai.client.chat.completions, "create",
        return_value=_fake_response(None),
    )
    assert ai.extract_medical_data("some text") == {}


# ── one failing step must not throw away the other ──────────────────────────
#
# Reading the document and understanding it are two calls against two models.
# When the second failed, the exception propagated, the record was marked
# failed, and a prescription whose text had been read perfectly well was shown
# as "couldn't be read". Seen live: 358 characters of correct OCR text on a
# record the app reported as unreadable.

class _ApiError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


@pytest.fixture(autouse=True)
def _no_waiting(monkeypatch):
    monkeypatch.setattr(ai_extractor.time, "sleep", lambda _s: None)


def test_a_rate_limited_extraction_is_waited_out(monkeypatch):
    attempts = {"n": 0}

    def create(**_kwargs):
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise _ApiError("rate limit reached", 429)
        return _fake_response('{"doctor_name": "Dr. Nambiar"}')

    monkeypatch.setattr(ai_extractor.client.chat.completions, "create", create)
    assert ai_extractor.extract_medical_data("some text")["doctor_name"] == "Dr. Nambiar"
    assert attempts["n"] == 3


def test_an_extraction_that_never_answers_gives_nothing_rather_than_raising(monkeypatch):
    """The caller keeps the document text; the details are left blank."""
    def create(**_kwargs):
        raise _ApiError("service unavailable", 503)

    monkeypatch.setattr(ai_extractor.client.chat.completions, "create", create)
    assert ai_extractor.extract_medical_data("some text") == {}


def test_extraction_retries_are_bounded(monkeypatch):
    attempts = {"n": 0}

    def create(**_kwargs):
        attempts["n"] += 1
        raise _ApiError("gateway timeout", 504)

    monkeypatch.setattr(ai_extractor.client.chat.completions, "create", create)
    ai_extractor.extract_medical_data("some text")
    assert attempts["n"] == ai_extractor.MAX_ATTEMPTS


def test_a_permanent_error_is_not_retried(monkeypatch):
    attempts = {"n": 0}

    def create(**_kwargs):
        attempts["n"] += 1
        raise _ApiError("invalid api key", 401)

    monkeypatch.setattr(ai_extractor.client.chat.completions, "create", create)
    assert ai_extractor.extract_medical_data("some text") == {}
    assert attempts["n"] == 1
