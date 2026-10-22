import sys
from io import BytesIO
from statistics import pstdev
from types import SimpleNamespace

import pytest
from PIL import Image

from app.ai.image import (
    MAX_IMAGE_SIDE,
    InvalidPhotoError,
    detect_faces_and_plates,
    prepare_photo,
)


def encoded_image(image_format="PNG", size=(32, 16), mode="RGB"):
    image = Image.new(mode, size, (120, 40, 20))
    output = BytesIO()
    image.save(output, format=image_format)
    return output.getvalue()


def test_prepare_photo_normalizes_png_to_small_jpeg_without_exif():
    normalized = prepare_photo(encoded_image(), region_detector=lambda _: [])
    with Image.open(BytesIO(normalized)) as image:
        assert image.format == "JPEG"
        assert image.width == 32
        assert image.height == 16
        assert not image.getexif()


def test_prepare_photo_normalizes_webp_to_jpeg():
    normalized = prepare_photo(encoded_image(image_format="WEBP"), region_detector=lambda _: [])
    with Image.open(BytesIO(normalized)) as image:
        assert image.format == "JPEG"


def test_prepare_photo_blurs_detected_sensitive_region():
    image = Image.new("RGB", (120, 80), "white")
    for x in range(30, 80):
        for y in range(20, 60):
            value = 0 if (x + y) % 2 else 255
            image.putpixel((x, y), (value, value, value))
    source = BytesIO()
    image.save(source, format="JPEG", quality=100)

    normalized = prepare_photo(source.getvalue(), region_detector=lambda _: [(30, 20, 50, 40)])
    with Image.open(BytesIO(normalized)) as redacted:
        before = image.crop((35, 25, 75, 55)).convert("L")
        after = redacted.crop((35, 25, 75, 55)).convert("L")
        assert pstdev(after.getdata()) < pstdev(before.getdata()) * 0.2


def test_bundled_cascade_detector_runs_on_a_plain_image():
    pytest.importorskip("cv2")
    assert detect_faces_and_plates(Image.new("RGB", (80, 60), "white")) == []


def test_face_and_plate_cascades_return_regions(monkeypatch):
    class FakeCascade:
        def __init__(self, path):
            self.kind = "face" if "frontalface" in path else "plate"

        def empty(self):
            return False

        def detectMultiScale(self, *_args, **_kwargs):
            return [(1, 2, 30, 30)] if self.kind == "face" else [(40, 50, 60, 20)]

    fake_cv2 = SimpleNamespace(
        data=SimpleNamespace(haarcascades="/models/"),
        CascadeClassifier=FakeCascade,
        COLOR_RGB2GRAY=1,
        cvtColor=lambda pixels, _code: pixels,
    )
    fake_numpy = SimpleNamespace(asarray=lambda image: image)
    monkeypatch.setitem(sys.modules, "cv2", fake_cv2)
    monkeypatch.setitem(sys.modules, "numpy", fake_numpy)
    assert detect_faces_and_plates(Image.new("RGB", (100, 80))) == [
        (1, 2, 30, 30),
        (40, 50, 60, 20),
    ]


def test_prepare_photo_downscales_long_edge():
    normalized = prepare_photo(encoded_image(size=(2000, 1000)), region_detector=lambda _: [])
    with Image.open(BytesIO(normalized)) as image:
        assert max(image.size) == MAX_IMAGE_SIDE
        assert image.size == (MAX_IMAGE_SIDE, 800)


@pytest.mark.parametrize(
    "data",
    [b"", b"not an image", b"\xff\xd8\xff" + b"x" * (5 * 1024 * 1024)],
    ids=["empty", "not-an-image", "oversized"],  # a 5 MB test id overflows Windows env vars
)
def test_prepare_photo_rejects_invalid_or_oversized_input(data):
    with pytest.raises(InvalidPhotoError):
        prepare_photo(data, region_detector=lambda _: [])


def test_prepare_photo_rejects_unsupported_format():
    with pytest.raises(InvalidPhotoError, match="JPEG, PNG, or WebP"):
        prepare_photo(encoded_image(image_format="GIF"), region_detector=lambda _: [])
