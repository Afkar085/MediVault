"""What is sent to the vision model: upright and size-capped, original untouched."""
import io

from PIL import Image

from app.services import ocr


def _jpeg(size, orientation=None):
    img = Image.new("RGB", size, "white")
    out = io.BytesIO()
    exif = Image.Exif()
    if orientation:
        exif[0x0112] = orientation
    img.save(out, format="JPEG", exif=exif.tobytes())
    return out.getvalue()


def test_an_upright_normal_photo_is_sent_unchanged():
    raw = _jpeg((1200, 1600))
    assert ocr.prepare_image(raw) == raw


def test_a_sideways_phone_photo_is_turned_upright():
    raw = _jpeg((1600, 1200), orientation=6)  # stored landscape, displayed portrait
    with Image.open(io.BytesIO(ocr.prepare_image(raw))) as img:
        assert img.size == (1200, 1600)


def test_a_huge_photo_is_scaled_down_keeping_its_shape():
    raw = _jpeg((6000, 4500))
    with Image.open(io.BytesIO(ocr.prepare_image(raw))) as img:
        assert max(img.size) == ocr.MAX_OCR_EDGE
        assert img.size == (2400, 1800)


def test_bytes_that_are_not_an_image_are_passed_through():
    assert ocr.prepare_image(b"not an image") == b"not an image"


# ── thumbnails ──────────────────────────────────────────────────────────────
#
# A record list draws each page at about forty pixels across and was doing it
# from the stored original: megabytes per row on a phone.

import io as _io

from PIL import Image as _Image

from app.services import document_files as _files


def _photo(width, height, exif_orientation=None):
    img = _Image.new("RGB", (width, height), (200, 40, 40))
    buf = _io.BytesIO()
    if exif_orientation:
        exif = _Image.Exif()
        exif[0x0112] = exif_orientation
        img.save(buf, format="JPEG", quality=95, exif=exif)
    else:
        img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def test_a_thumbnail_is_much_smaller_than_the_page():
    original = _photo(3000, 4000)
    small = _files.make_thumbnail(original, "image/jpeg")

    assert small is not None
    assert len(small) < len(original) / 10
    with _Image.open(_io.BytesIO(small)) as img:
        assert max(img.size) <= _files.THUMBNAIL_MAX_EDGE


def test_a_thumbnail_keeps_the_page_the_right_way_up():
    """The viewer honours the EXIF flag; a thumbnail is raw pixels, so a
    portrait prescription would otherwise show up on its side."""
    portrait = _photo(1200, 900, exif_orientation=6)  # rotate 90 to display
    small = _files.make_thumbnail(portrait, "image/jpeg")

    with _Image.open(_io.BytesIO(small)) as img:
        assert img.height > img.width


def test_a_pdf_has_no_thumbnail_rather_than_a_broken_one():
    assert _files.make_thumbnail(b"%PDF-1.4 not really a pdf", "application/pdf") is None


def test_undecodable_bytes_give_no_thumbnail_instead_of_raising():
    assert _files.make_thumbnail(b"\xff\xd8\xff not a jpeg at all", "image/jpeg") is None


def test_a_thumbnail_lives_beside_its_page_under_the_same_prefix():
    """Same per-user, per-member prefix, so it inherits the same access rules."""
    path = "user-1/profile-2/abc123.jpg"
    assert _files.thumbnail_path(path).startswith("user-1/profile-2/")
    assert _files.thumbnail_path(path) != path
    assert _files.thumbnail_path(path).endswith(".jpg")


def test_storing_a_page_stores_its_thumbnail_too(monkeypatch):
    uploaded = []

    class _Bucket:
        @staticmethod
        def upload(path, file, file_options=None):
            uploaded.append((path, len(file)))
            return {"path": path}

    monkeypatch.setattr(_files.supabase.storage, "from_", lambda _b: _Bucket(), raising=False)

    original = _photo(2000, 1500)
    _files.store([{"file_path": "u/p/x.jpg", "contents": original, "content_type": "image/jpeg"}])

    paths = [p for p, _ in uploaded]
    assert "u/p/x.jpg" in paths
    assert _files.thumbnail_path("u/p/x.jpg") in paths
    sizes = dict(uploaded)
    assert sizes[_files.thumbnail_path("u/p/x.jpg")] < sizes["u/p/x.jpg"]


def test_a_thumbnail_failure_never_fails_the_upload(monkeypatch):
    """The document is what matters; the small copy is derived data."""
    calls = []

    class _Bucket:
        @staticmethod
        def upload(path, file, file_options=None):
            calls.append(path)
            if path.endswith(_files.THUMBNAIL_SUFFIX):
                raise RuntimeError("storage said no")
            return {"path": path}

    monkeypatch.setattr(_files.supabase.storage, "from_", lambda _b: _Bucket(), raising=False)

    _files.store([{"file_path": "u/p/y.jpg", "contents": _photo(900, 900), "content_type": "image/jpeg"}])
    assert "u/p/y.jpg" in calls  # the page itself still went up
