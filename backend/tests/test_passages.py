"""Document-text retrieval, including what happens when pgvector is absent.

The on-the-fly path is the one that runs on the current host, so it gets the
most attention here.
"""
import pytest

from app.services import passages

KNEE_OCR = """Dr. S. Kumar, MS Ortho
Diagnosis: Osteoarthritis, right knee

Rx: Paracetamol 650mg twice daily after food for 5 days.
Advice: physiotherapy three times a week. Review after one month.
"""

BLOOD_OCR = """COMPLETE BLOOD COUNT

Haemoglobin        9.2 g/dL      (13.0 - 17.0)
Total WBC          7400 /cumm

IMPRESSION: Mild anaemia. Suggest iron studies.
"""

ROWS = [
    {"id": "r-knee", "raw_ocr_text": KNEE_OCR},
    {"id": "r-blood", "raw_ocr_text": BLOOD_OCR},
]


class _Table:
    def __init__(self, store):
        self.store = store

    def select(self, *_):
        return self

    def in_(self, column, values):
        self.store["scoped_to"] = list(values)
        return self

    def execute(self):
        if self.store.get("fail"):
            raise RuntimeError("database unreachable")
        allowed = self.store.get("scoped_to") or []
        return type("R", (), {"data": [r for r in ROWS if r["id"] in allowed]})()


@pytest.fixture
def db(monkeypatch):
    store = {}

    def rpc(*_a, **_k):
        raise RuntimeError("match_chunks does not exist")

    monkeypatch.setattr(
        passages, "supabase",
        type("S", (), {
            "table": staticmethod(lambda name: _Table(store)),
            "rpc": staticmethod(rpc),
        })(),
    )
    # No embedding model, which is the state on the deployed host.
    monkeypatch.setattr(passages, "embed_text", lambda _t: None)
    return store


# --- the path that runs without pgvector ------------------------------------

def test_a_value_only_present_in_the_document_text_is_found(db):
    """This is the whole point: 9.2 is in the scan and in no column."""
    found = passages.relevant_passages(["r-knee", "r-blood"], "haemoglobin")
    assert found
    assert "9.2 g/dL" in found[0]["text"]
    assert found[0]["record_id"] == "r-blood"


def test_the_reference_range_comes_with_the_value(db):
    found = passages.relevant_passages(["r-blood"], "haemoglobin")
    assert "13.0 - 17.0" in found[0]["text"]


def test_an_instruction_that_was_never_extracted_is_found(db):
    found = passages.relevant_passages(["r-knee", "r-blood"], "how often physiotherapy")
    assert "three times a week" in found[0]["text"]


def test_nothing_is_returned_when_the_documents_do_not_mention_it(db):
    """Returning unrelated text would invite the model to answer from it."""
    assert passages.relevant_passages(["r-knee", "r-blood"], "dentist appointment") == []


def test_a_question_of_only_stopwords_retrieves_nothing(db):
    assert passages.relevant_passages(["r-knee"], "what is the") == []


# --- authorization -----------------------------------------------------------

def test_only_the_records_passed_in_are_ever_read(db):
    passages.relevant_passages(["r-knee"], "haemoglobin")
    assert db["scoped_to"] == ["r-knee"]


def test_a_record_not_passed_in_cannot_leak_into_the_result(db):
    found = passages.relevant_passages(["r-knee"], "haemoglobin")
    assert all(p["record_id"] == "r-knee" for p in found)


def test_no_records_means_no_query_at_all(db):
    assert passages.relevant_passages([], "haemoglobin") == []
    assert "scoped_to" not in db


# --- degradation -------------------------------------------------------------

def test_a_database_failure_degrades_to_nothing_rather_than_raising(db):
    db["fail"] = True
    assert passages.relevant_passages(["r-blood"], "haemoglobin") == []


def test_one_long_document_cannot_crowd_out_the_others(db):
    found = passages.relevant_passages(["r-knee", "r-blood"], "the", limit=10)
    counts = {}
    for p in found:
        counts[p["record_id"]] = counts.get(p["record_id"], 0) + 1
    assert all(c <= passages.MAX_PER_RECORD for c in counts.values())


def test_the_limit_is_respected(db):
    assert len(passages.relevant_passages(["r-knee", "r-blood"], "the", limit=1)) <= 1


# --- the pgvector path -------------------------------------------------------

def _indexed_db(monkeypatch, indexed, rpc_rows):
    """A database where `indexed` records have stored passages."""
    calls = {}

    def rpc(name, args):
        calls["name"] = name
        calls["record_ids"] = args["p_record_ids"]
        return type("Q", (), {"execute": lambda self: type("R", (), {"data": rpc_rows})()})()

    class _Passages:
        def select(self, *_): return self
        def in_(self, _c, values):
            calls["indexed_lookup"] = list(values)
            return self
        def execute(self):
            return type("R", (), {"data": [{"record_id": r} for r in indexed]})()

    store = {}

    def table(name):
        return _Passages() if name == "document_passages" else _Table(store)

    monkeypatch.setattr(passages, "embed_text", lambda _t: [0.0] * 384)
    monkeypatch.setattr(
        passages, "supabase",
        type("S", (), {"rpc": staticmethod(rpc), "table": staticmethod(table)})(),
    )
    store["scoped_to"] = None
    return calls, store


def test_stored_passages_are_used_when_the_index_exists(monkeypatch):
    calls, _ = _indexed_db(
        monkeypatch,
        indexed=["r-knee", "r-blood"],
        rpc_rows=[{"record_id": "r-blood", "content": "Haemoglobin 9.2 g/dL", "similarity": 0.81}],
    )

    found = passages.relevant_passages(["r-knee", "r-blood"], "sugar levels")

    assert calls["name"] == "match_chunks"
    assert calls["record_ids"] == ["r-blood", "r-knee"]  # scope is passed through
    assert found[0]["text"] == "Haemoglobin 9.2 g/dL"


def test_records_indexed_before_the_migration_are_still_searched(monkeypatch):
    """The dangerous case: one indexed record must not hide all the others."""
    calls, _ = _indexed_db(
        monkeypatch,
        indexed=["r-knee"],  # r-blood predates migration 004
        rpc_rows=[{"record_id": "r-knee", "content": "knee passage", "similarity": 0.7}],
    )

    found = passages.relevant_passages(["r-knee", "r-blood"], "haemoglobin")

    # Only the indexed record went to the vector search...
    assert calls["record_ids"] == ["r-knee"]
    # ...and the unindexed one was still scanned, so its value is found.
    assert any("9.2 g/dL" in p["text"] for p in found)


def test_a_missing_chunk_index_falls_back_instead_of_failing(db, monkeypatch):
    """Migration 004 not applied is the normal case, not an error."""
    monkeypatch.setattr(passages, "embed_text", lambda _t: [0.0] * 384)
    found = passages.relevant_passages(["r-blood"], "haemoglobin")
    assert "9.2 g/dL" in found[0]["text"]
