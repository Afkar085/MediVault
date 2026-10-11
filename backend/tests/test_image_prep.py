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
