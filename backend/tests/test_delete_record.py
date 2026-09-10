"""Deleting a record must actually delete it — and must never report success
when the row is still there.

These cover the real failure modes behind "I clicked Delete and it came back":
the wrong record being removed, another record being affected, and a silent
delete (0 rows changed) being reported as success.
"""
import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import records as rec


class _R:
    def __init__(self, data):
        self.data = data


class _Storage:
    def __init__(self, store):
        self.store = store

    def from_(self, _bucket):
        return self

    def remove(self, paths):
        self.store.setdefault("removed", []).extend(paths)
        return _R([])


class _Table:
    def __init__(self, name, store):
        self.name, self.store, self._op, self._f = name, store, None, {}

    def select(self, *_a):
        self._op = "select"
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, k, v):
        self._f[k] = v
        return self

    def _match(self, r):
        return all(r.get(k) == v for k, v in self._f.items())

    def execute(self):
        rows = self.store.setdefault(self.name, [])
        if self._op == "select":
            return _R([dict(r) for r in rows if self._match(r)])
        if self._op == "delete":
            if self.store.get("block_delete"):     # simulate a silent RLS no-op
                return _R([])
            removed = [r for r in rows if self._match(r)]
            self.store[self.name] = [r for r in rows if not self._match(r)]
            return _R(removed)
        return _R([])


class _DB:
    def __init__(self, store):
        self.store = store
        self.storage = _Storage(store)

    def table(self, name):
        return _Table(name, self.store)


@pytest.fixture
def db(monkeypatch):
    store = {
        "profiles": [{"id": "p1", "user_id": "u1"}],
        "records": [
            {"id": "rA", "profile_id": "p1", "file_path": "a.png"},
            {"id": "rB", "profile_id": "p1", "file_path": "b.png"},
        ],
        "record_files": [{"record_id": "rA", "file_path": "a.png"}],
    }
    monkeypatch.setattr(rec, "supabase", _DB(store))
    return store


def ids(store):
    return sorted(r["id"] for r in store["records"])


def test_delete_removes_the_right_record_and_leaves_others(db):
    out = rec.delete_record("p1", "rA", user_id="u1")
    assert out["message"] == "Record deleted"
    assert ids(db) == ["rB"]                     # A gone, B untouched
    assert "a.png" in db.get("removed", [])      # its stored file was cleaned up


def test_deleting_a_missing_record_is_404_and_touches_nothing(db):
    with pytest.raises(HTTPException) as e:
        rec.delete_record("p1", "does-not-exist", user_id="u1")
    assert e.value.status_code == 404
    assert ids(db) == ["rA", "rB"]


def test_cannot_delete_a_record_on_a_profile_you_do_not_own(db):
    with pytest.raises(HTTPException) as e:
        rec.delete_record("p1", "rA", user_id="someone-else")
    assert e.value.status_code == 404
    assert ids(db) == ["rA", "rB"]               # nothing deleted


def test_a_silent_delete_is_reported_as_an_error_not_false_success(db):
    """The bug behind 'it came back after refresh': backend returns 200 but the
    row is still there. The endpoint must raise instead of claiming success."""
    db["block_delete"] = True
    with pytest.raises(HTTPException) as e:
        rec.delete_record("p1", "rA", user_id="u1")
    assert e.value.status_code == 500
    assert ids(db) == ["rA", "rB"]               # still present; no false success
