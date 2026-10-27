"""Catching up on thumbnails for documents stored before they existed.

Every document anyone already has was uploaded without a small copy, so the
fix for the phone being slow does nothing for them until those exist. Rather
than a migration run by hand with production credentials, a record list
queues a few in the background.
"""
import pytest

from app.services import thumbnail_backfill as backfill


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    """Each test gets an empty queue and no memory of earlier paths."""
    import queue

    monkeypatch.setattr(backfill, "enabled", True)
    monkeypatch.setattr(backfill, "_queue", queue.Queue(maxsize=backfill.QUEUE_SIZE))
    monkeypatch.setattr(backfill, "_seen", set())
    # Never start the real worker: these tests are about what gets queued.
    monkeypatch.setattr(backfill, "_ensure_worker", lambda: None)


def queued():
    return list(backfill._queue.queue)


def test_a_page_with_no_thumbnail_is_queued():
    assert backfill.queue_missing(["u/p/a.jpg"]) == 1
    assert queued() == ["u/p/a.jpg"]


def test_one_list_does_not_queue_a_whole_account():
    """A big account catches up over several loads instead of stalling one."""
    paths = [f"u/p/{i}.jpg" for i in range(40)]
    assert backfill.queue_missing(paths) == backfill.MAX_PER_REQUEST
    assert len(queued()) == backfill.MAX_PER_REQUEST


def test_the_same_page_is_never_queued_twice():
    backfill.queue_missing(["u/p/a.jpg"])
    assert backfill.queue_missing(["u/p/a.jpg"]) == 0
    assert queued() == ["u/p/a.jpg"]


def test_a_page_that_failed_is_not_retried_forever():
    """Attempted once per process, successful or not, so nothing can loop."""
    backfill.queue_missing(["u/p/broken.jpg"])
    backfill._queue.get()  # the worker takes it and fails
    assert backfill.queue_missing(["u/p/broken.jpg"]) == 0


def test_a_full_queue_waits_for_the_next_request_instead_of_dropping(monkeypatch):
    import queue as _q

    monkeypatch.setattr(backfill, "_queue", _q.Queue(maxsize=1))
    assert backfill.queue_missing(["u/p/a.jpg"]) == 1
    assert backfill.queue_missing(["u/p/b.jpg"]) == 0
    # b was not remembered, so a later request can still pick it up.
    backfill._queue.get()
    assert backfill.queue_missing(["u/p/b.jpg"]) == 1


def test_nothing_is_queued_when_it_is_switched_off(monkeypatch):
    monkeypatch.setattr(backfill, "enabled", False)
    assert backfill.queue_missing(["u/p/a.jpg"]) == 0


def test_empty_paths_are_ignored():
    assert backfill.queue_missing([None, "", None]) == 0


# ── making one ──────────────────────────────────────────────────────────────

def _bucket(monkeypatch, original=b"", fail_download=False, fail_upload=False):
    uploaded = []

    class _B:
        @staticmethod
        def download(_path):
            if fail_download:
                raise RuntimeError("no such object")
            return original

        @staticmethod
        def upload(path, file, file_options=None):
            if fail_upload:
                raise RuntimeError("storage said no")
            uploaded.append((path, len(file)))
            return {"path": path}

    monkeypatch.setattr(backfill.supabase.storage, "from_", lambda _b: _B(), raising=False)
    return uploaded


def _photo():
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (2400, 1800), (10, 120, 200)).save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def test_making_one_writes_a_smaller_copy_beside_the_page(monkeypatch):
    original = _photo()
    uploaded = _bucket(monkeypatch, original=original)

    backfill._make_one("u/p/a.jpg")

    assert len(uploaded) == 1
    path, size = uploaded[0]
    assert path == backfill.thumbnail_path("u/p/a.jpg")
    assert size < len(original) / 10


def test_the_original_is_never_written(monkeypatch):
    uploaded = _bucket(monkeypatch, original=_photo())
    backfill._make_one("u/p/a.jpg")
    assert all(p != "u/p/a.jpg" for p, _ in uploaded)


def test_a_download_failure_is_survived(monkeypatch):
    uploaded = _bucket(monkeypatch, fail_download=True)
    backfill._make_one("u/p/a.jpg")  # must not raise
    assert uploaded == []


def test_an_upload_failure_is_survived(monkeypatch):
    _bucket(monkeypatch, original=_photo(), fail_upload=True)
    backfill._make_one("u/p/a.jpg")  # must not raise


def test_a_pdf_is_left_alone(monkeypatch):
    uploaded = _bucket(monkeypatch, original=b"%PDF-1.4 a scanned page")
    backfill._make_one("u/p/scan.pdf")
    assert uploaded == []
