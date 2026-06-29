"""Tests for grounded RAG answering (Groq mocked, no network)."""
from types import SimpleNamespace
import app.services.rag as rag


def _fake_response(content: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


def test_build_context_numbers_and_cites():
    records = [
        {"id": "r1", "document_date": "2026-01-10", "doctor_name": "Dr. A", "diagnosis": "Flu"},
        {"id": "r2", "document_date": "2026-02-20", "doctor_name": "Dr. B",
         "medicines": [{"name": "Amoxicillin"}]},
    ]
    context, sources = rag.build_context(records)
    assert "[Record 1]" in context and "[Record 2]" in context
    assert "Amoxicillin" in context
    assert sources[0]["record_id"] == "r1"
    assert sources[1]["ref"] == 2


def test_answer_question_with_no_records_skips_llm(mocker):
    spy = mocker.patch.object(rag.client.chat.completions, "create")
    result = rag.answer_question("anything", [], {"name": "X"})
    assert result["sources"] == []
    spy.assert_not_called()


def test_answer_question_returns_grounded_answer(mocker):
    mocker.patch.object(
        rag.client.chat.completions,
        "create",
        return_value=_fake_response("You took Metformin [Record 1]."),
    )
    records = [{"id": "r1", "document_date": "2026-03-01", "diagnosis": "Diabetes"}]
    result = rag.answer_question("what meds?", records, {"name": "Afkar"})
    assert "Metformin" in result["answer"]
    assert result["sources"][0]["record_id"] == "r1"
