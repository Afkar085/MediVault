"""Editing a prescription must not be able to lose it.

Replacing a record's medicines is a delete followed by an insert, with no
transaction between them. These tests pin down what happens when the insert
does not land.
"""
import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import records as records_endpoint
from app.api.v1.endpoints.records import _replace_medicines

EXISTING = [
    {"name": "Paracetamol", "dosage": "650mg", "frequency": "Twice daily", "duration": "5 days"},
    {"name": "Pantoprazole", "dosage": "40mg", "frequency": "Once daily", "duration": "5 days"},
]


class _Medicines:
    """Records every call so the test can assert on the sequence, not just the end state."""

    def __init__(self, store):
        self.store = store
        self._pending_insert = None

    def select(self, *_):
        self.store["log"].append("select")
        return self

    def eq(self, *_):
        return self

    def delete(self):
        self.store["log"].append("delete")
        self.store["rows"] = []
        return self

    def insert(self, rows):
        self._pending_insert = rows
        return self

    def execute(self):
        if self._pending_insert is not None:
            rows = self._pending_insert
            self._pending_insert = None
            self.store["log"].append("insert")
            if self.store.get("fail_inserts_remaining", 0) > 0:
                self.store["fail_inserts_remaining"] -= 1
                raise RuntimeError("insert rejected")
            self.store["rows"] = [dict(r) for r in rows]
            return type("R", (), {"data": self.store["rows"]})()
        return type("R", (), {"data": [dict(r) for r in self.store["rows"]]})()


@pytest.fixture
def db(monkeypatch):
    store = {"rows": [dict(r) for r in EXISTING], "log": []}
    monkeypatch.setattr(
        records_endpoint, "supabase",
        type("S", (), {"table": staticmethod(lambda _n: _Medicines(store))})(),
    )
    return store


def names(store):
    return [r["name"] for r in store["rows"]]


def test_medicines_are_replaced_with_the_new_set(db):
    _replace_medicines("r1", [{"name": "Ibuprofen", "dosage": "400mg"}])
    assert names(db) == ["Ibuprofen"]
    assert db["rows"][0]["dosage"] == "400mg"


def test_an_empty_list_clears_them(db):
    _replace_medicines("r1", [])
    assert db["rows"] == []


def test_entries_without_a_name_are_dropped(db):
    _replace_medicines("r1", [{"name": "  "}, {"name": "Ibuprofen"}, {"dosage": "5mg"}])
    assert names(db) == ["Ibuprofen"]


def test_blank_fields_are_stored_as_nothing_rather_than_empty_strings(db):
    _replace_medicines("r1", [{"name": "Ibuprofen", "dosage": "", "frequency": None}])
    assert db["rows"][0]["dosage"] is None
    assert db["rows"][0]["frequency"] is None


# --- the failure that used to lose the prescription --------------------------

def test_a_failed_insert_puts_the_old_medicines_back(db):
    db["fail_inserts_remaining"] = 1

    with pytest.raises(HTTPException):
        _replace_medicines("r1", [{"name": "Ibuprofen"}])

    assert names(db) == ["Paracetamol", "Pantoprazole"]
    assert db["rows"][0]["dosage"] == "650mg"  # the detail survives too


def test_a_failed_insert_is_reported_rather_than_silently_swallowed(db):
    db["fail_inserts_remaining"] = 1

    with pytest.raises(HTTPException) as exc:
        _replace_medicines("r1", [{"name": "Ibuprofen"}])

    assert exc.value.status_code == 502
    assert "Nothing was changed" in exc.value.detail


def test_the_old_medicines_are_read_before_anything_is_deleted(db):
    """The snapshot is worthless if it is taken after the delete."""
    _replace_medicines("r1", [{"name": "Ibuprofen"}])
    assert db["log"].index("select") < db["log"].index("delete")


def test_a_record_with_no_medicines_yet_still_reports_a_failed_insert(db):
    db["rows"] = []
    db["fail_inserts_remaining"] = 1

    with pytest.raises(HTTPException):
        _replace_medicines("r1", [{"name": "Ibuprofen"}])

    assert db["rows"] == []


def test_a_failed_restore_does_not_mask_the_original_error(db):
    """Both inserts fail: the user must still be told the save did not work."""
    db["fail_inserts_remaining"] = 2

    with pytest.raises(HTTPException) as exc:
        _replace_medicines("r1", [{"name": "Ibuprofen"}])

    assert exc.value.status_code == 502
