"""Documents must only ever be reachable through short-lived signed URLs."""
import pytest

from app.services import storage
from app.services.document_files import ALLOWED_TYPES, _EXTENSION_BY_TYPE


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


# Signed URLs are cached in the process (see storage._cache), so one test's
# URL would otherwise answer the next test's request.
@pytest.fixture(autouse=True)
def _no_cached_urls():
    storage.forget_signed_urls()
    yield
    storage.forget_signed_urls()


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


# ── not signing the same path twice ─────────────────────────────────────────
#
# A URL is good for an hour; re-signing it on every refresh is a network
# round-trip per page of every record, which was most of the cost of loading
# the records list.

def test_a_signed_url_is_reused_instead_of_signed_again(bucket):
    b = bucket(_Bucket(single={"signedURL": "https://x/1"}))
    assert storage.signed_url("a.jpg") == "https://x/1"
    assert storage.signed_url("a.jpg") == "https://x/1"
    assert b.single_calls == ["a.jpg"]


def test_a_batch_only_signs_the_paths_it_does_not_already_have(bucket):
    b = bucket(_Bucket(batch=[{"path": "a.jpg", "signedURL": "https://x/1"}]))
    storage.signed_urls(["a.jpg"])

    b._batch = [{"path": "b.jpg", "signedURL": "https://x/2"}]
    result = storage.signed_urls(["a.jpg", "b.jpg"])

    assert result == {"a.jpg": "https://x/1", "b.jpg": "https://x/2"}
    assert b.batch_calls == [["a.jpg"], ["b.jpg"]]  # "a" was never re-signed


def test_an_all_cached_batch_makes_no_request_at_all(bucket):
    b = bucket(_Bucket(batch=[{"path": "a.jpg", "signedURL": "https://x/1"}]))
    storage.signed_urls(["a.jpg"])
    b.batch_calls.clear()

    assert storage.signed_urls(["a.jpg"]) == {"a.jpg": "https://x/1"}
    assert b.batch_calls == []


def test_a_url_close_to_expiry_is_not_reused(bucket):
    """Handing out a URL with seconds left would show a broken image."""
    b = bucket(_Bucket(single={"signedURL": "https://x/1"}))
    storage.signed_url("a.jpg", expires_in=storage._SIGNED_URL_MARGIN)
    assert storage.signed_url("a.jpg", expires_in=storage._SIGNED_URL_MARGIN) == "https://x/1"
    assert b.single_calls == ["a.jpg", "a.jpg"]


def test_a_failure_is_not_cached(bucket):
    b = bucket(_Bucket(single=RuntimeError("signing is down")))
    assert storage.signed_url("a.jpg") is None
    b._single = {"signedURL": "https://x/1"}
    assert storage.signed_url("a.jpg") == "https://x/1"


def test_a_deleted_document_is_forgotten(bucket):
    b = bucket(_Bucket(single={"signedURL": "https://x/1"}))
    storage.signed_url("a.jpg")
    storage.forget_signed_urls(["a.jpg"])
    b._single = {"signedURL": "https://x/2"}
    assert storage.signed_url("a.jpg") == "https://x/2"


# ── signing things that might not be there ──────────────────────────────────
#
# Thumbnails arrive after the pages they belong to, so many of the paths in a
# list do not exist yet. Supabase rejects a whole batch when one path is
# missing. Putting thumbnails in with the originals therefore made every
# record list fall back to signing each object on its own: a 2 second list
# became 27 seconds against the real deployment.

def test_a_missing_path_never_falls_back_to_one_request_per_object(bucket):
    b = bucket(_Bucket(batch=RuntimeError("Object not found"), single={"signedURL": "https://x/1"}))

    result = storage.signed_urls_if_present(["a.thumb.jpg", "b.thumb.jpg", "c.thumb.jpg"])

    assert result == {}
    assert b.single_calls == []          # the expensive path was not taken
    assert len(b.batch_calls) == 1       # one request, then it gave up


def test_paths_known_to_be_missing_are_not_asked_about_again(bucket):
    b = bucket(_Bucket(batch=RuntimeError("Object not found")))
    storage.signed_urls_if_present(["a.thumb.jpg"])
    storage.signed_urls_if_present(["a.thumb.jpg"])

    assert len(b.batch_calls) == 1  # the second list cost nothing


def test_the_ones_that_do_exist_still_come_back(bucket):
    bucket(_Bucket(batch=[
        {"path": "a.thumb.jpg", "signedURL": "https://x/a"},
        {"path": "b.thumb.jpg", "error": "Object not found"},
    ]))

    result = storage.signed_urls_if_present(["a.thumb.jpg", "b.thumb.jpg"])

    assert result == {"a.thumb.jpg": "https://x/a"}


def test_a_thumbnail_that_appears_later_is_picked_up(bucket):
    """The backfill makes these after the fact, so "missing" cannot be forever."""
    b = bucket(_Bucket(batch=[{"path": "a.thumb.jpg", "error": "Object not found"}]))
    assert storage.signed_urls_if_present(["a.thumb.jpg"]) == {}

    storage.forget_signed_urls()  # what the TTL does, deterministically
    b._batch = [{"path": "a.thumb.jpg", "signedURL": "https://x/a"}]
    assert storage.signed_urls_if_present(["a.thumb.jpg"]) == {"a.thumb.jpg": "https://x/a"}


def test_a_found_thumbnail_is_cached_like_any_other_url(bucket):
    b = bucket(_Bucket(batch=[{"path": "a.thumb.jpg", "signedURL": "https://x/a"}]))
    storage.signed_urls_if_present(["a.thumb.jpg"])
    storage.signed_urls_if_present(["a.thumb.jpg"])

    assert len(b.batch_calls) == 1


def test_signing_real_documents_still_falls_back_when_the_batch_is_down(bucket):
    """The opposite policy, deliberately: these exist and are worth the cost."""
    b = bucket(_Bucket(batch=RuntimeError("batch is down"), single={"signedURL": "https://x/1"}))

    assert storage.signed_urls(["a.jpg"]) == {"a.jpg": "https://x/1"}
    assert b.single_calls == ["a.jpg"]
