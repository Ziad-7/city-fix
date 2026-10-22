import asyncio
from io import BytesIO

import httpx
from PIL import Image
import pytest
from fastapi import HTTPException

from app.storage import SupabaseMediaStorage


def test_signed_upload_is_user_scoped_private_and_no_overwrite():
    requests = []

    def handle(request):
        requests.append(request)
        if request.url.path.endswith("/bucket/report-media"):
            return httpx.Response(200, json={"id": "report-media", "public": False})
        return httpx.Response(
            200,
            json={
                "signedUrl": "/storage/v1/object/upload/sign/report-media/u1/key.jpg?token=t"
            },
        )

    storage = SupabaseMediaStorage(
        "https://project.supabase.co", "secret", transport=httpx.MockTransport(handle)
    )
    url, path = storage.sign_upload("u1", "report_photo", "image/jpeg")
    assert path.startswith("u1/") and path.endswith(".jpg")
    assert url.endswith("?token=t")
    assert requests[0].method == "GET"
    assert requests[1].method == "POST"
    assert requests[1].headers["authorization"] == "Bearer secret"


def test_require_uploaded_checks_owner_type_and_size():
    def handle(request):
        if request.url.path.endswith("/bucket/report-media"):
            return httpx.Response(200, json={"id": "report-media", "public": False})
        return httpx.Response(
            200,
            headers={"content-type": "image/jpeg", "content-length": "123"},
        )

    storage = SupabaseMediaStorage(
        "https://project.supabase.co", "secret", transport=httpx.MockTransport(handle)
    )
    storage.require_uploaded("u1", "u1/key.jpg", "report_photo")
    with pytest.raises(HTTPException) as wrong_owner:
        storage.require_uploaded("u1", "u2/key.jpg", "report_photo")
    assert wrong_owner.value.status_code == 403


def test_read_approved_requires_per_request_consent():
    def handle(request):
        if request.method == "HEAD":
            return httpx.Response(
                200, headers={"content-type": "image/jpeg", "content-length": "10"}
            )
        return httpx.Response(200, content=b"not really jpeg")

    storage = SupabaseMediaStorage(
        "https://project.supabase.co", "secret", transport=httpx.MockTransport(handle)
    )
    with pytest.raises(HTTPException) as denied:
        asyncio.run(storage.read_approved("u1", "u1/photo.jpg", "report_photo", False))
    assert denied.value.status_code == 403


def test_read_approved_verifies_owner_before_returning_photo_bytes():
    source = BytesIO()
    Image.new("RGB", (32, 24), (20, 40, 60)).save(source, format="JPEG")
    calls = []

    def handle(request):
        calls.append(request.method)
        if request.url.path.endswith("/bucket/report-media"):
            return httpx.Response(200, json={"id": "report-media", "public": False})
        if request.method == "HEAD":
            return httpx.Response(
                200,
                headers={
                    "content-type": "image/jpeg",
                    "content-length": str(len(source.getvalue())),
                },
            )
        return httpx.Response(
            200, content=source.getvalue(), headers={"content-type": "image/jpeg"}
        )

    storage = SupabaseMediaStorage(
        "https://project.supabase.co", "secret", transport=httpx.MockTransport(handle)
    )
    returned = asyncio.run(
        storage.read_approved("u1", "u1/photo.jpg", "report_photo", True)
    )
    assert calls == ["GET", "HEAD", "GET"]
    assert Image.open(BytesIO(returned)).format == "JPEG"


def test_rejects_unsafe_paths_and_wrong_media_type():
    storage = SupabaseMediaStorage("https://project.supabase.co", "secret")
    for path in ("u1/../secret.jpg", "u1//photo.jpg", "https://evil/photo.jpg"):
        with pytest.raises(HTTPException):
            storage.require_uploaded("u1", path, "report_photo")


def test_rejects_public_bucket_before_signing_uploads():
    storage = SupabaseMediaStorage(
        "https://project.supabase.co",
        "secret",
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200, json={"id": "report-media", "public": True}
            )
        ),
    )
    with pytest.raises(HTTPException) as error:
        storage.sign_upload("u1", "report_photo", "image/jpeg")
    assert error.value.status_code == 503


def test_rejects_signed_urls_from_another_origin_or_port():
    storage = SupabaseMediaStorage("https://project.supabase.co", "secret")
    for url in (
        "https://attacker.example/storage/v1/object/sign/file",
        "https://project.supabase.co:8443/storage/v1/object/sign/file",
    ):
        with pytest.raises(HTTPException) as error:
            storage._resolve_signed_url(url)
        assert error.value.status_code == 502
