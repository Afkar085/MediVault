"""Refresh tokens: staying signed in, and what happens when one is stolen."""
from datetime import datetime, timedelta, timezone

import pytest

from app.core import sessions


class _Query:
    """Enough of the Supabase query builder for the session store."""

    def __init__(self, rows):
        self.rows = rows
        self.selected = list(rows)
        self.payload = None
        self.mode = None
        self.limit_n = None

    # -- builders ----------------------------------------------------------
    def insert(self, payload):
        self.mode, self.payload = "insert", payload
        return self

    def select(self, _columns):
        self.mode = "select"
        return self

    def update(self, payload):
        self.mode, self.payload = "update", payload
        return self

    def eq(self, column, value):
        self.selected = [r for r in self.selected if r.get(column) == value]
        return self

    def is_(self, column, _null):
        self.selected = [r for r in self.selected if r.get(column) is None]
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    # -- terminal ----------------------------------------------------------
    def execute(self):
        if self.mode == "insert":
            row = {"id": f"row-{len(self.rows)}", "used_at": None, "revoked_at": None, **self.payload}
            self.rows.append(row)
            return type("Result", (), {"data": [row]})()
        if self.mode == "update":
            for row in self.selected:
                row.update(self.payload)
            return type("Result", (), {"data": list(self.selected)})()
        rows = self.selected[: self.limit_n] if self.limit_n else self.selected
        return type("Result", (), {"data": [dict(r) for r in rows]})()


class _Supabase:
    def __init__(self):
        self.rows = []

    def table(self, _name):
        return _Query(self.rows)


@pytest.fixture
def store(monkeypatch):
    fake = _Supabase()
    monkeypatch.setattr(sessions, "supabase", fake)
    return fake


def test_a_token_can_be_exchanged_for_a_new_one(store):
    raw = sessions.issue("user-1")
    assert raw

    rotated = sessions.rotate(raw)
    assert rotated is not None
    user_id, new_raw = rotated
    assert user_id == "user-1"
    assert new_raw != raw


def test_the_raw_token_is_never_stored(store):
    raw = sessions.issue("user-1")
    stored = [r["token_hash"] for r in store.rows]
    assert raw not in stored
    assert all(len(h) == 64 for h in stored)  # sha256 hex


def test_a_rotated_token_keeps_its_family(store):
    raw = sessions.issue("user-1")
    _, new_raw = sessions.rotate(raw)
    sessions.rotate(new_raw)
    assert len({r["family_id"] for r in store.rows}) == 1


def test_a_spent_token_is_refused(store):
    raw = sessions.issue("user-1")
    sessions.rotate(raw)
    assert sessions.rotate(raw) is None


def test_replaying_a_spent_token_revokes_the_whole_session(store):
    """The only way to present one twice is for a copy to exist, so the
    session that token came from must end, on every device it reached."""
    raw = sessions.issue("user-1")
    _, live = sessions.rotate(raw)

    sessions.rotate(raw)  # the replay

    assert sessions.rotate(live) is None
    assert all(r["revoked_at"] for r in store.rows)


def test_another_users_session_survives_a_replay(store):
    other = sessions.issue("user-2")
    raw = sessions.issue("user-1")
    sessions.rotate(raw)
    sessions.rotate(raw)  # replay on user-1's family only

    assert sessions.rotate(other) is not None


def test_an_expired_token_is_refused(store):
    raw = sessions.issue("user-1")
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    store.rows[0]["expires_at"] = past
    assert sessions.rotate(raw) is None


def test_a_revoked_token_is_refused(store):
    raw = sessions.issue("user-1")
    sessions.revoke(raw)
    assert sessions.rotate(raw) is None


def test_signing_out_one_device_leaves_the_others_signed_in(store):
    phone = sessions.issue("user-1")
    laptop = sessions.issue("user-1")
    sessions.revoke(phone)
    assert sessions.rotate(laptop) is not None


def test_deleting_the_account_ends_every_session(store):
    phone = sessions.issue("user-1")
    laptop = sessions.issue("user-1")
    sessions.revoke_all("user-1")
    assert sessions.rotate(phone) is None
    assert sessions.rotate(laptop) is None


def test_an_unknown_token_is_simply_not_a_session(store):
    assert sessions.rotate("made-up") is None
    assert sessions.rotate("") is None


def test_an_unreachable_store_fails_closed_rather_than_erroring(monkeypatch):
    class _Broken:
        def table(self, _name):
            raise RuntimeError("database unreachable")

    monkeypatch.setattr(sessions, "supabase", _Broken())
    assert sessions.issue("user-1") is None
    assert sessions.rotate("anything") is None
    sessions.revoke("anything")      # must not raise
    sessions.revoke_all("user-1")    # must not raise
