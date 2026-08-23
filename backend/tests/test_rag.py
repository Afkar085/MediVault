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


# --- document text in the prompt (previously missing entirely) ---------------

RECORDS = [
    {"id": "r-blood", "document_date": "2026-05-02", "doctor_name": "Dr. Bhat",
     "diagnosis": "Anaemia"},
]


def test_the_document_text_reaches_the_model(mocker):
    """Extracted fields alone cannot answer "what was the value?"."""
    mocker.patch.object(
        rag, "relevant_passages",
        return_value=[{"record_id": "r-blood", "text": "Haemoglobin 9.2 g/dL (13.0 - 17.0)"}],
    )
    context, sources = rag.build_context(RECORDS, "what was my haemoglobin?")
    assert "From the document:" in context
    assert "9.2 g/dL" in context
    assert sources[0]["quoted"] is True


def test_passages_are_attributed_to_the_record_they_came_from(mocker):
    mocker.patch.object(
        rag, "relevant_passages",
        return_value=[
            {"record_id": "r2", "text": "belongs to the second record"},
            {"record_id": "r1", "text": "belongs to the first record"},
        ],
    )
    records = [{"id": "r1", "doctor_name": "Dr. A"}, {"id": "r2", "doctor_name": "Dr. B"}]
    context, _ = rag.build_context(records, "anything")

    first, second = context.split("[Record 2]")
    assert "belongs to the first record" in first
    assert "belongs to the second record" in second


def test_a_record_with_no_matching_passage_is_marked_as_unquoted(mocker):
    mocker.patch.object(rag, "relevant_passages", return_value=[])
    _, sources = rag.build_context(RECORDS, "unrelated question")
    assert sources[0]["quoted"] is False


def test_retrieval_is_not_attempted_without_a_question(mocker):
    spy = mocker.patch.object(rag, "relevant_passages")
    rag.build_context(RECORDS)
    spy.assert_not_called()


def test_passage_retrieval_failing_degrades_to_the_extracted_fields(mocker):
    """A broken passage index must cost precision, not the whole answer."""
    mocker.patch.object(rag, "relevant_passages", side_effect=RuntimeError("index down"))
    context, sources = rag.build_context(RECORDS, "what was my haemoglobin?")
    assert "Dr. Bhat" in context          # the fields still made it
    assert "From the document:" not in context
    assert sources[0]["quoted"] is False


def test_a_broken_passage_index_still_yields_an_answer(mocker):
    mocker.patch.object(rag, "relevant_passages", side_effect=RuntimeError("index down"))
    mocker.patch.object(
        rag.client.chat.completions, "create",
        return_value=_fake_response("Dr. Bhat recorded anaemia [Record 1]."),
    )
    result = rag.answer_question("what was my haemoglobin?", RECORDS, {"name": "Afkar"})
    assert "anaemia" in result["answer"]


# --- hallucination guards ----------------------------------------------------

def test_the_prompt_forbids_outside_knowledge_and_invented_values(mocker):
    mocker.patch.object(rag, "relevant_passages", return_value=[])
    captured = {}

    def capture(**kwargs):
        captured.update(kwargs)
        return _fake_response("ok")

    mocker.patch.object(rag.client.chat.completions, "create", side_effect=capture)
    rag.answer_question("what was my haemoglobin?", RECORDS, {"name": "Afkar"})

    prompt = captured["messages"][0]["content"]
    assert "ONLY the records below" in prompt
    assert "Do not use outside knowledge" in prompt
    assert "Never round, convert or estimate" in prompt
    assert "do not advise starting, stopping or changing any treatment" in prompt
    assert captured["temperature"] <= 0.2


def test_an_empty_model_reply_becomes_an_honest_not_found(mocker):
    """A blank completion must never be shown as if it were an answer."""
    mocker.patch.object(rag, "relevant_passages", return_value=[])
    mocker.patch.object(rag.client.chat.completions, "create", return_value=_fake_response("   "))
    result = rag.answer_question("anything", RECORDS, {"name": "Afkar"})
    assert result["answer"] == rag.NOT_IN_RECORDS


def test_no_records_says_so_without_calling_the_model(mocker):
    spy = mocker.patch.object(rag.client.chat.completions, "create")
    result = rag.answer_question("anything", [], {"name": "Afkar"})
    assert result["answer"] == rag.NOT_IN_RECORDS
    spy.assert_not_called()


def test_a_model_failure_never_fabricates_an_answer(mocker):
    mocker.patch.object(rag, "relevant_passages", return_value=[])
    mocker.patch.object(rag.client.chat.completions, "create", side_effect=RuntimeError("down"))
    result = rag.answer_question("anything", RECORDS, {"name": "Afkar"})
    assert "couldn't generate" in result["answer"]
    # Sources are still returned so the user can go read the records themselves.
    assert result["sources"][0]["record_id"] == "r-blood"


def test_every_source_maps_to_a_record_that_was_actually_in_context(mocker):
    mocker.patch.object(rag, "relevant_passages", return_value=[])
    records = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    context, sources = rag.build_context(records, "q")
    assert [s["ref"] for s in sources] == [1, 2, 3]
    assert [s["record_id"] for s in sources] == ["a", "b", "c"]
    for source in sources:
        assert f"[Record {source['ref']}]" in context
