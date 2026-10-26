"""A record goes back to the client with its medicines and its pages attached.

Both come from separate round-trips to Supabase, and they are fetched at the
same time. The point of these tests is that doing so changed nothing about
what comes back, and that a failure in either is still raised.
"""
import threading
import time

import pytest

from app.services import record_assembly


class _Query:
    def __init__(self, table, rows, delay, fail):
        self.table, self.rows, self.delay, self.fail = table, rows, delay, fail

    def select(self, _columns):
        return self

    def in_(self, _column, _values):
        return self

    def order(self, _column):
        return self

    def execute(self):
        time.sleep(self.delay)
        if self.fail == self.table:
            raise RuntimeError(f"{self.table} is unreachable")
        return type("Result", (), {"data": list(self.rows.get(self.table, []))})()


class _Supabase:
    def __init__(self, rows, delay=0.0, fail=None):
        self.rows, self.delay, self.fail = rows, delay, fail
        self.tables_seen = []
        self.lock = threading.Lock()

    def table(self, name):
        with self.lock:
            self.tables_seen.append(name)
        return _Query(name, self.rows, self.delay, self.fail)


ROWS = {
    "medicines": [{"record_id": "r-1", "name": "Paracetamol"}],
    "record_files": [{"id": "f-1", "record_id": "r-1", "file_path": "a.jpg", "page_number": 1}],
}


@pytest.fixture
def store(monkeypatch):
    def install(**kwargs):
        fake = _Supabase(ROWS, **kwargs)
        monkeypatch.setattr(record_assembly, "supabase", fake)
        monkeypatch.setattr(record_assembly, "signed_urls", lambda paths: {p: "https://x/" + p for p in paths})
        return fake

    return install


def test_a_record_comes_back_with_its_medicines_and_pages(store):
    store()
    records = record_assembly.attach_related([{"id": "r-1", "file_path": "a.jpg"}])

    assert [m["name"] for m in records[0]["medicines"]] == ["Paracetamol"]
    assert [f["file_path"] for f in records[0]["files"]] == ["a.jpg"]
    assert records[0]["file_url"] == "https://x/a.jpg"


def test_a_record_with_neither_gets_empty_lists_not_missing_keys(store):
    store()
    records = record_assembly.attach_related([{"id": "r-other", "file_path": None}])

    assert records[0]["medicines"] == []
    assert records[0]["files"] == []
    assert records[0]["file_url"] is None


def test_nothing_is_fetched_for_an_empty_list(store):
    fake = store()
    assert record_assembly.attach_related([]) == []
    assert fake.tables_seen == []


def test_the_two_fetches_overlap_instead_of_queueing(store):
    """Serially these would cost two round-trips; together they cost one."""
    fake = store(delay=0.15)
    started = time.monotonic()
    record_assembly.attach_related([{"id": "r-1", "file_path": "a.jpg"}])
    elapsed = time.monotonic() - started

    assert sorted(fake.tables_seen) == ["medicines", "record_files"]
    assert elapsed < 0.28  # one delay's worth, not two


def test_a_failure_in_either_fetch_still_surfaces(store):
    store(fail="medicines")
    with pytest.raises(RuntimeError):
        record_assembly.attach_related([{"id": "r-1", "file_path": "a.jpg"}])

    store(fail="record_files")
    with pytest.raises(RuntimeError):
        record_assembly.attach_related([{"id": "r-1", "file_path": "a.jpg"}])
