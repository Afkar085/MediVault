"""Tests for the extraction JSON parsing (Groq client mocked, no network)."""
from types import SimpleNamespace
import app.services.ai_extractor as ai


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
