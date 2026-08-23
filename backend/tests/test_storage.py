"""Documents must only ever be reachable through short-lived signed URLs."""
import pytest

from app.services import storage
from app.api.v1.endpoints.upload import ALLOWED_TYPES, _EXTENSION_BY_TYPE


class _Bucket:
    """Stand-in for the Supabase storage bucket proxy."""

    def __init__(self, single=None, batch=None):
        self._single = single
        self._batch = batch
        self.single_calls = []
        self.batch_calls = []

    def create_signed_url(self, path, expires_in):
        self.single_calls.append(path)
        if isinstance(self._single, Exception):
            raise self._single
        return self._single

    def create_signed_urls(self, paths, expires_in):
        self.batch_calls.append(list(paths))
        if isinstance(self._batch, Exception):
            raise self._batch
        return self._batch

    def get_public_url(self, path):  # pragma: no cover - must never be called
        raise AssertionError("public URLs must never be handed out for documents")


@pytest.fixture
def bucket(monkeypatch):
    holder = {}

    def install(b):
        holder["bucket"] = b
        monkeypatch.setattr(
            storage.supabase.storage, "from_", lambda name: b, raising=False
        )
        return b

    return install


def test_signed_url_returns_url(bucket):
    bucket(_Bucket(single={"signedURL": "https://x/sign/abc"}))
    assert storage.signed_url("u/p/a.jpg") == "https://x/sign/abc"


def test_signed_url_returns_none_instead_of_public_url(bucket):
    """A signing failure must NOT degrade into a permanent public link."""
    bucket(_Bucket(single=RuntimeError("signing is down")))
    assert storage.signed_url("u/p/a.jpg") is None


def test_signed_url_ignores_empty_path(bucket):
    b = bucket(_Bucket(single={"signedURL": "https://x/sign/abc"}))
    assert storage.signed_url("") is None
    assert b.single_calls == []


def test_signed_urls_signs_every_path_in_one_request(bucket):
    b = bucket(
        _Bucket(
            batch=[
                {"path": "a.jpg", "signedURL": "https://x/1"},
                {"path": "b.jpg", "signedURL": "https://x/2"},
            ]
        )
    )
    result = storage.signed_urls(["a.jpg", "b.jpg", "a.jpg"])
    assert result == {"a.jpg": "https://x/1", "b.jpg": "https://x/2"}
    assert len(b.batch_calls) == 1  # one round-trip, not one per file
    assert b.batch_calls[0] == ["a.jpg", "b.jpg"]  # de-duplicated
    assert b.single_calls == []


def test_signed_urls_falls_back_when_batch_unavailable(bucket):
    b = bucket(
        _Bucket(batch=RuntimeError("no batch endpoint"), single={"signedURL": "https://x/s"})
    )
    assert storage.signed_urls(["a.jpg", "b.jpg"]) == {
        "a.jpg": "https://x/s",
        "b.jpg": "https://x/s",
    }
    assert b.single_calls == ["a.jpg", "b.jpg"]


def test_signed_urls_reports_failed_paths_as_none(bucket):
    bucket(
        _Bucket(
            batch=[
                {"path": "a.jpg", "signedURL": "https://x/1"},
                {"path": "b.jpg", "error": "not found"},
            ]
        )
    )
    assert storage.signed_urls(["a.jpg", "b.jpg"]) == {"a.jpg": "https://x/1", "b.jpg": None}


def test_signed_urls_of_nothing_makes_no_request(bucket):
    b = bucket(_Bucket(batch=[]))
    assert storage.signed_urls([None, ""]) == {}
    assert b.batch_calls == []


def test_every_accepted_upload_type_has_a_safe_extension():
    """Storage keys are built from the verified type, never the filename.

    A filename such as "x.pdf/../../victim" would otherwise escape the
    per-user prefix in the object key.
    """
    assert set(_EXTENSION_BY_TYPE) == ALLOWED_TYPES
    for ext in _EXTENSION_BY_TYPE.values():
        assert ext.isalnum(), ext
