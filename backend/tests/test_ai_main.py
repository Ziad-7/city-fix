import pytest
from fastapi import HTTPException

from app.main import app, load_approved_triage_photo


def test_main_api_registers_triage_with_the_shared_auth_dependency():
    openapi = app.openapi()
    paths = openapi["paths"]
    assert "/triage" in paths
    assert "/uploads/sign" in paths
    assert paths["/triage"]["post"]["security"] == [{"HTTPBearer": []}]
    assert openapi["components"]["securitySchemes"]["HTTPBearer"] == {
        "scheme": "bearer",
        "type": "http",
    }


@pytest.mark.anyio
async def test_photo_loader_requires_the_private_storage_adapter():
    previous = getattr(app.state, "media_storage", None)
    app.state.media_storage = None
    try:
        with pytest.raises(HTTPException) as error:
            await load_approved_triage_photo("private/photo.jpg", "citizen-1", True)
        assert error.value.status_code == 503
    finally:
        app.state.media_storage = previous


@pytest.mark.anyio
async def test_photo_loader_uses_only_the_approved_storage_method():
    class ApprovedStorage:
        def __init__(self):
            self.args = None

        async def read_approved(self, user_id, path, kind, consent):
            self.args = (user_id, path, kind, consent)
            return b"approved-photo-bytes"

    previous = getattr(app.state, "media_storage", None)
    storage = ApprovedStorage()
    app.state.media_storage = storage
    try:
        photo = await load_approved_triage_photo("private/photo.jpg", "citizen-1", True)
        assert photo == b"approved-photo-bytes"
        assert storage.args == (
            "citizen-1",
            "private/photo.jpg",
            "report_photo",
            True,
        )
    finally:
        app.state.media_storage = previous
