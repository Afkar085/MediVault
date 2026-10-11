"""Attaching a document to an existing record must MERGE, not duplicate.

process_added_pages is what keeps a visit to a single record: a second photo of
the same prescription is folded into the existing record. These tests pin down
the merge rules — dedupe medicines, fill only missing details, never overwrite —
so the behaviour that keeps retrieval/RAG content clean can't silently regress.
"""
import pytest

from app.api.v1.endpoints import upload as upload_endpoint
from app.api.v1.endpoints.upload import _norm_med, process_added_pages


# --- _norm_med ---------------------------------------------------------------

def test_norm_med_collapses_brand_variants():
    assert _norm_med("AZEE") == _norm_med("AZEE 500MG TABLET")
    assert _norm_med("JUSTRIL") == _norm_med("JUSTRIL FORTE tab")
    assert _norm_med("Ebast-DC") == _norm_med("EBAST-DC TABLET")


def test_norm_med_keeps_different_drugs_distinct():
    assert _norm_med("Paracetamol") != _norm_med("Pantoprazole")


def test_norm_med_handles_blank():
    assert _norm_med("") == ""
    assert _norm_med(None) == ""


# --- process_added_pages merge semantics ------------------------------------

class _R:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self, name, store):
        self.name = name
        self.store = store
        self._op = None
        self._payload = None
        self._filters = {}

    def select(self, *_cols):
        self._op = "select"
        return self

    def insert(self, rows):
        self._op = "insert"
        self._payload = rows
        return self

    def update(self, data):
        self._op = "update"
        self._payload = data
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def order(self, *_a, **_k):
        return self

    def _match(self, r):
        return all(r.get(k) == v for k, v in self._filters.items())

    def execute(self):
        rows = self.store.setdefault(self.name, [])
        if self._op == "select":
            return _R([dict(r) for r in rows if self._match(r)])
        if self._op == "insert":
            payload = self._payload if isinstance(self._payload, list) else [self._payload]
            added = []
            for r in payload:
                r = dict(r)
                r.setdefault("id", f"{self.name}-{len(rows) + len(added) + 1}")
                added.append(r)
            rows.extend(added)
            return _R([dict(r) for r in added])
        if self._op == "update":
            updated = []
            for r in rows:
                if self._match(r):
                    r.update(self._payload)
                    updated.append(dict(r))
            return _R(updated)
        if self._op == "delete":
            self.store[self.name] = [r for r in rows if not self._match(r)]
            return _R([])
        return _R([])


@pytest.fixture
def db(monkeypatch):
    store = {
        "records": [{
            "id": "r1",
            "doctor_name": "Dr. Shetty",   # already known — must NOT be overwritten
            "diagnosis": None,             # missing — should be filled
            "document_category": "prescription",
            "raw_ocr_text": "handwritten page",
        }],
        "medicines": [{"id": "m1", "record_id": "r1", "name": "AZEE 500"}],
    }
    monkeypatch.setattr(
        upload_endpoint, "supabase",
        type("S", (), {"table": staticmethod(lambda n: _Table(n, store))})(),
    )
    # New page reads as some text; skip the network OCR entirely.
    monkeypatch.setattr(upload_endpoint, "read_pages", lambda *a, **k: ["printed page"])
    # Record what gets re-indexed for retrieval without touching a real store.
    indexed = {}
    monkeypatch.setattr(upload_endpoint, "index_passages",
                        lambda rid, text: indexed.update({"rid": rid, "text": text}))
    # Deterministic extraction from the new page.
    import app.services.ai_extractor as ai
    monkeypatch.setattr(ai, "extract_medical_data", lambda text: {
        "diagnosis": "URTI",
        "doctor_name": "Dr. Someone Else",
        "medicines": [{"name": "AZEE 500MG TABLET"}, {"name": "Paracetamol"}],
    })
    store["_indexed"] = indexed
    return store


def _med_names(store):
    return sorted(m["name"] for m in store["medicines"])


def test_missing_field_is_filled_but_known_field_is_kept(db):
    process_added_pages("r1", [{"file_path": "p2.jpg"}], ["image/jpeg"])
    rec = db["records"][0]
    assert rec["diagnosis"] == "URTI"            # was missing -> filled
    assert rec["doctor_name"] == "Dr. Shetty"    # already set -> untouched
    assert rec["status"] == "done"


def test_duplicate_medicine_is_not_added_but_new_one_is(db):
    process_added_pages("r1", [{"file_path": "p2.jpg"}], ["image/jpeg"])
    # AZEE already present (same brand) -> skipped; Paracetamol is new -> added.
    assert _med_names(db) == ["AZEE 500", "Paracetamol"]


def test_text_is_combined_and_reindexed_once(db):
    process_added_pages("r1", [{"file_path": "p2.jpg"}], ["image/jpeg"])
    rec = db["records"][0]
    assert "handwritten page" in rec["raw_ocr_text"]
    assert "printed page" in rec["raw_ocr_text"]
    # Retrieval index rebuilt over the full combined text (not two copies).
    assert db["_indexed"]["rid"] == "r1"
    assert "handwritten page" in db["_indexed"]["text"]
    assert "printed page" in db["_indexed"]["text"]
