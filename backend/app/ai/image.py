from io import BytesIO
from typing import Callable

from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_SIDE = 1600


class InvalidPhotoError(ValueError):
    """The uploaded report photo is invalid or exceeds the supported limits."""


class PrivacyFilterUnavailable(RuntimeError):
    """The local face/plate detector could not be loaded safely."""


Region = tuple[int, int, int, int]
RegionDetector = Callable[[Image.Image], list[Region]]


def detect_faces_and_plates(image: Image.Image) -> list[Region]:
    """Detect frontal faces and plate-like regions using bundled OpenCV cascades."""
    try:
        import cv2
        import numpy as np

        cascade_root = cv2.data.haarcascades
        face_detector = cv2.CascadeClassifier(f"{cascade_root}haarcascade_frontalface_default.xml")
        plate_detector = cv2.CascadeClassifier(f"{cascade_root}haarcascade_russian_plate_number.xml")
        if face_detector.empty() or plate_detector.empty():
            raise PrivacyFilterUnavailable("OpenCV privacy cascades are missing")
        pixels = np.asarray(image.convert("RGB"))
        grayscale = cv2.cvtColor(pixels, cv2.COLOR_RGB2GRAY)
        faces = face_detector.detectMultiScale(grayscale, scaleFactor=1.1, minNeighbors=5, minSize=(24, 24))
        plates = plate_detector.detectMultiScale(grayscale, scaleFactor=1.05, minNeighbors=3, minSize=(48, 14))
        return [tuple(map(int, box)) for box in (*faces, *plates)]
    except PrivacyFilterUnavailable:
        raise
    except Exception as error:
        raise PrivacyFilterUnavailable("OpenCV privacy detection failed") from error


def blur_regions(image: Image.Image, regions: list[Region]) -> Image.Image:
    """Blur detected sensitive regions with margins so their boundaries are covered."""
    redacted = image.convert("RGB").copy()
    width, height = redacted.size
    for x, y, box_width, box_height in regions:
        if box_width <= 0 or box_height <= 0:
            continue
        margin_x = max(4, int(box_width * 0.18))
        margin_y = max(4, int(box_height * 0.18))
        left = max(0, x - margin_x)
        top = max(0, y - margin_y)
        right = min(width, x + box_width + margin_x)
        bottom = min(height, y + box_height + margin_y)
        if right <= left or bottom <= top:
            continue
        crop = redacted.crop((left, top, right, bottom))
        radius = max(8.0, min(crop.size) * 0.22)
        redacted.paste(crop.filter(ImageFilter.GaussianBlur(radius)), (left, top))
    return redacted


def prepare_photo(data: bytes, *, region_detector: RegionDetector = detect_faces_and_plates) -> bytes:
    if not data or len(data) > MAX_PHOTO_BYTES:
        raise InvalidPhotoError("Photo must be between 1 byte and 5 MB")
    try:
        with Image.open(BytesIO(data)) as probe:
            if probe.format not in {"JPEG", "PNG", "WEBP"}:
                raise InvalidPhotoError("Photo must be a JPEG, PNG, or WebP image")
            width, height = probe.size
            if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
                raise InvalidPhotoError("Photo dimensions are not supported")
            probe.verify()
        with Image.open(BytesIO(data)) as opened:
            image = ImageOps.exif_transpose(opened)
            image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)
            if image.mode in {"RGBA", "LA", "P"}:
                rgba = image.convert("RGBA")
                background = Image.new("RGB", rgba.size, "white")
                background.paste(rgba, mask=rgba.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")
            image = blur_regions(image, region_detector(image))
            result = BytesIO()
            image.save(result, format="JPEG", quality=85, optimize=True)
            return result.getvalue()
    except InvalidPhotoError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise InvalidPhotoError("Photo could not be decoded") from error
