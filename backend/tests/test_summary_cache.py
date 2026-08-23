"""A generated summary should survive until the records behind it change."""
import pytest

from app.services import summary_cache

RECORDS = [
    {"id": "r1", "updated_at": "2026-06-14T10:00:00Z"},
    {"id": "r2", "updated_at": "2026-05-02T10:00:00Z"},
]


@pytest.fixture(autouse=True)
def clean():
    summary_cache.clear()
    yield
    summary_cache.clear()


def test_a_stored_summary_is_returned_again():
    fp = summary_cache.fingerprint(RECORDS)
    summary_cache.put("p1", fp, "- June 2026: saw Dr Kumar")
    assert summary_cache.get("p1", fp) == "- June 2026: saw Dr Kumar"


def test_nothing_is_returned_before_anything_is_stored():
    assert summary_cache.get("p1", summary_cache.fingerprint(RECORDS)) is None


def test_editing_a_record_invalidates_the_summary():
    fp = summary_cache.fingerprint(RECORDS)
    summary_cache.put("p1", fp, "old summary")

    edited = [{**RECORDS[0], "updated_at": "2026-08-01T00:00:00Z"}, RECORDS[1]]
    assert summary_cache.get("p1", summary_cache.fingerprint(edited)) is None


def test_uploading_a_record_invalidates_the_summary():
    summary_cache.put("p1", summary_cache.fingerprint(RECORDS), "old summary")
    added = RECORDS + [{"id": "r3", "updated_at": "2026-08-20T00:00:00Z"}]
    assert summary_cache.get("p1", summary_cache.fingerprint(added)) is None


def test_deleting_a_record_invalidates_the_summary():
    summary_cache.put("p1", summary_cache.fingerprint(RECORDS), "old summary")
    assert summary_cache.get("p1", summary_cache.fingerprint(RECORDS[:1])) is None


def test_record_order_does_not_change_the_fingerprint():
    assert summary_cache.fingerprint(RECORDS) == summary_cache.fingerprint(list(reversed(RECORDS)))


def test_one_members_summary_is_never_served_to_another():
    fp = summary_cache.fingerprint(RECORDS)
    summary_cache.put("p1", fp, "Afkar's journey")
    assert summary_cache.get("p2", fp) is None


def test_an_empty_summary_is_not_stored():
    """A failed generation must not be remembered as the answer."""
    fp = summary_cache.fingerprint(RECORDS)
    summary_cache.put("p1", fp, "")
    assert summary_cache.get("p1", fp) is None


def test_the_cache_stays_bounded():
    for i in range(summary_cache.MAX_ENTRIES + 40):
        summary_cache.put(f"p{i}", "fp", f"summary {i}")
    assert len(summary_cache._cache) == summary_cache.MAX_ENTRIES
    # The oldest entries are the ones dropped.
    assert summary_cache.get("p0", "fp") is None
    assert summary_cache.get(f"p{summary_cache.MAX_ENTRIES + 39}", "fp") is not None


def test_reading_an_entry_keeps_it_alive():
    summary_cache.put("keep", "fp", "wanted")
    for i in range(summary_cache.MAX_ENTRIES - 1):
        summary_cache.put(f"p{i}", "fp", "filler")
        summary_cache.get("keep", "fp")
    summary_cache.put("new", "fp", "newest")
    assert summary_cache.get("keep", "fp") == "wanted"
