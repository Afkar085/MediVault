"""Tests for the embedding text builder + graceful degradation."""
import app.services.embeddings as emb


def test_build_record_text_includes_key_fields():
    record = {
        "doctor_name": "Dr. Rao",
        "diagnosis": "Type 2 Diabetes",
        "specialty": "Endocrinology",
        "raw_ocr_text": "blood sugar elevated",
    }
    meds = [{"name": "Metformin"}, {"name": ""}]
    text = emb.build_record_text(record, meds)
    assert "Dr. Rao" in text
    assert "Type 2 Diabetes" in text
    assert "Metformin" in text
    assert "Endocrinology" in text


def test_build_record_text_handles_empty():
    assert emb.build_record_text({}, []) == ""


def test_embed_text_returns_none_when_model_unavailable(mocker):
    mocker.patch.object(emb, "_get_model", return_value=None)
    assert emb.embed_text("anything") is None


def test_embed_text_returns_none_for_empty_input():
    assert emb.embed_text("") is None
    assert emb.embed_text("   ") is None
