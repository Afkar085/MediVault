"""Multi-page uploads must read pages at once, in order, and survive a bad page."""
import time

import pytest

from app.api.v1.endpoints import upload

PAGE_DELAY = 0.25


@pytest.fixture
def ocr(monkeypatch):
    """Replace storage + vision with something slow enough to time."""
    def install(texts, failing=frozenset()):
        seen = []

        class _Storage:
            @staticmethod
            def from_(_bucket):
                class _Bucket:
                    @staticmethod
                    def download(path):
                        seen.append(path)
                        time.sleep(PAGE_DELAY)
                        if path in failing:
                            raise RuntimeError("storage is unhappy about this page")
                        return path.encode()
                return _Bucket()

        monkeypatch.setattr(upload, "supabase", type("S", (), {"storage": _Storage()})())
        monkeypatch.setattr(
            upload, "extract_text_from_bytes",
            lambda data, ct: texts[data.decode()],
        )
        return seen

    return install


def entries(*paths):
    return [{"file_path": p} for p in paths]


def test_pages_come_back_in_page_order(ocr):
    ocr({"p1": "first", "p2": "second", "p3": "third"})
    assert upload.read_pages(entries("p1", "p2", "p3"), ["image/png"] * 3) == [
        "first", "second", "third",
    ]


def test_pages_are_read_concurrently(ocr):
    """Four pages must not take four times as long as one."""
    ocr({f"p{i}": f"text {i}" for i in range(4)})
    started = time.monotonic()
    upload.read_pages(entries("p0", "p1", "p2", "p3"), ["image/png"] * 4)
    elapsed = time.monotonic() - started

    assert elapsed < PAGE_DELAY * 4 * 0.75, f"pages still look sequential ({elapsed:.2f}s)"


def test_concurrency_stays_bounded(ocr, monkeypatch):
    """One upload must not be able to exhaust the vision API's rate limit."""
    monkeypatch.setattr(upload, "MAX_CONCURRENT_PAGES", 2)
    ocr({f"p{i}": f"text {i}" for i in range(8)})

    started = time.monotonic()
    upload.read_pages(entries(*[f"p{i}" for i in range(8)]), ["image/png"] * 8)
    elapsed = time.monotonic() - started

    # 8 pages, 2 at a time => at least 4 sequential rounds.
    assert elapsed >= PAGE_DELAY * 4 * 0.8


def test_one_unreadable_page_does_not_lose_the_others(ocr):
    ocr({"p1": "first", "p3": "third"}, failing={"p2"})
    result = upload.read_pages(entries("p1", "p2", "p3"), ["image/png"] * 3)
    assert result == ["first", "", "third"]


def test_a_single_page_is_read_without_a_thread_pool(ocr):
    ocr({"p1": "only page"})
    assert upload.read_pages(entries("p1"), ["image/png"]) == ["only page"]


def test_no_pages_reads_nothing(ocr):
    seen = ocr({})
    assert upload.read_pages([], []) == []
    assert seen == []


def test_a_missing_content_type_does_not_break_the_page(ocr):
    """content_types can be shorter than the page list on legacy records."""
    ocr({"p1": "first", "p2": "second"})
    assert upload.read_pages(entries("p1", "p2"), ["image/png"]) == ["first", "second"]
