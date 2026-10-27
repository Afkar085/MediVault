"""Give older documents the small copy they were uploaded without.

Thumbnails are made at upload time, but every document stored before that
existed has none, and those are exactly the ones people already have. Rather
than requiring anyone to run a migration script with production credentials,
the app fills the gap itself: when a record list notices a page with no small
copy, it queues one to be made in the background.

Deliberately modest about it:

* a handful of pages per request, so a big account spreads over a few loads
  rather than stalling one;
* one worker thread, so a small host is never doing several at once;
* every path is attempted once per process, successful or not, so nothing
  can loop;
* failures are silent. A page without a thumbnail falls back to the original,
  which is what it did before.

Nothing here reads or writes a record. It only adds a derived file beside one
that already exists, under the same per-user prefix.
"""
import queue
import threading

from app.database import supabase
from app.logger import logger
from app.services.document_files import (
    content_type_for_path, make_thumbnail, thumbnail_path,
)
from app.services.storage import BUCKET

# Per request, so one page load never waits on a long tail of old documents.
MAX_PER_REQUEST = 4
# Bounded: if the queue is full the rest wait for the next request.
QUEUE_SIZE = 64

# Switched off in tests, which have no storage to read from and must not go
# near the network. Production leaves it on.
enabled = True

_queue: "queue.Queue[str]" = queue.Queue(maxsize=QUEUE_SIZE)
_seen: set = set()
_seen_lock = threading.Lock()
_worker: threading.Thread = None
_worker_lock = threading.Lock()


def _make_one(path: str) -> None:
    try:
        original = supabase.storage.from_(BUCKET).download(path)
    except Exception as e:
        logger.info("Backfill: could not read %s (%s)", path, type(e).__name__)
        return
    small = make_thumbnail(original, content_type_for_path(path))
    if not small:
        return  # a PDF, or bytes Pillow cannot read: it keeps using the original
    try:
        supabase.storage.from_(BUCKET).upload(
            path=thumbnail_path(path),
            file=small,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )
        logger.info("Backfill: %s %d KB -> %d KB", path, len(original) // 1024, len(small) // 1024)
    except Exception as e:
        logger.info("Backfill: could not store a thumbnail for %s (%s)", path, type(e).__name__)


def _run() -> None:
    while True:
        path = _queue.get()
        try:
            _make_one(path)
        except Exception as e:  # pragma: no cover - the worker must never die
            logger.warning("Backfill worker error on %s: %s", path, type(e).__name__)
        finally:
            _queue.task_done()


def _ensure_worker() -> None:
    global _worker
    with _worker_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_run, name="thumbnail-backfill", daemon=True)
            _worker.start()


def queue_missing(paths) -> int:
    """Queue up to MAX_PER_REQUEST pages for a thumbnail. Returns how many."""
    if not enabled:
        return 0
    queued = 0
    for path in paths:
        if queued >= MAX_PER_REQUEST:
            break
        if not path:
            continue
        with _seen_lock:
            if path in _seen:
                continue
            _seen.add(path)
        try:
            _queue.put_nowait(path)
            queued += 1
        except queue.Full:
            with _seen_lock:
                _seen.discard(path)  # try again on a later request
            break
    if queued:
        _ensure_worker()
    return queued
