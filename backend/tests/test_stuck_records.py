"""A background OCR job that never finishes must not strand the record."""
from datetime import datetime, timedelta, timezone

import pytest

from app.api.v1.endpoints import records as records_endpoint
from app.api.v1.endpoints.records import PROCESSING_TIMEOUT, _expire_stuck_processing


class _Query:
    """Records the filter chain so the test can assert on the final query."""

    def __init__(self, table, fail=False, returned=None):
        self.table = table
        self.fail = fail
        self.returned = returned or []
        self.calls = {}

    def update(self, payload):
        self.calls["update"] = payload
        return self

    def eq(self, column, value):
        self.calls.setdefault("eq", []).append((column, value))
        return self

    def in_(self, column, values):
        self.calls["in_"] = (column, values)
        return self

    def lt(self, column, value):
        self.calls["lt"] = (column, value)
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("database unreachable")
        return type("Result", (), {"data": self.returned})()


class _Supabase:
    def __init__(self, **kwargs):
        self.query = None
        self.kwargs = kwargs

    def table(self, name):
        self.query = _Query(name, **self.kwargs)
        return self.query


@pytest.fixture
def fake_supabase(monkeypatch):
    def install(**kwargs):
        fake = _Supabase(**kwargs)
        monkeypatch.setattr(records_endpoint, "supabase", fake)
        return fake

    return install


def test_stuck_records_are_marked_failed(fake_supabase):
    fake = fake_supabase(returned=[{"id": "r-1"}])
    _expire_stuck_processing("p-1")

    calls = fake.query.calls
    assert fake.query.table == "records"
    assert calls["update"] == {"status": "failed"}
    assert ("profile_id", "p-1") in calls["eq"]
    assert calls["in_"] == ("status", ["processing", "extracting"])


def test_only_records_older_than_the_timeout_are_touched(fake_supabase):
    fake = fake_supabase()
    before = datetime.now(timezone.utc)
    _expire_stuck_processing("p-1")
    after = datetime.now(timezone.utc)

    column, cutoff = fake.query.calls["lt"]
    assert column == "created_at"
    cutoff_at = datetime.fromisoformat(cutoff)
    # An upload started a moment ago must survive; only genuinely stale ones go.
    assert before - PROCESSING_TIMEOUT <= cutoff_at <= after - PROCESSING_TIMEOUT
    assert PROCESSING_TIMEOUT >= timedelta(minutes=5)


def test_cleanup_failure_never_breaks_the_read(fake_supabase):
    fake_supabase(fail=True)
    _expire_stuck_processing("p-1")  # must not raise
