from dataclasses import dataclass

from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
import pytest

from app.ai.router import create_triage_router
from app.ai.image import PrivacyFilterUnavailable, prepare_photo
from app.ai.schemas import CategoryId
from ai_tests.test_ai_image import encoded_image
from ai_tests.test_ai_triage import FakeProvider, model_suggestion


@dataclass
class User:
    id: str


def make_client(
    *,
    user_id="citizen-1",
    loader=None,
    nearby=None,
    provider=None,
    photo_analysis_enabled=True,
    photo_preparer=None,
):
    calls = {"photo": [], "nearby": []}

    async def authenticate():
        if user_id is None:
            raise HTTPException(401, "Unauthorized")
        return User(user_id)

    async def load_photo(path, owner_id, consent):
        calls["photo"].append((path, owner_id, consent))
        if loader:
            return await loader(path, owner_id, consent)
        return encoded_image()

    async def find_nearby(category_id, lat, lng, radius_m, owner_id):
        calls["nearby"].append((category_id, lat, lng, radius_m, owner_id))
        if nearby:
            return await nearby(category_id, lat, lng, radius_m, owner_id)
        return {"duplicates": [], "alreadyReported": []}

    app = FastAPI()
    app.include_router(
        create_triage_router(
            get_current_user=authenticate,
            load_authorized_photo=load_photo,
            find_nearby_incidents=find_nearby,
            provider=provider,
            photo_analysis_enabled=photo_analysis_enabled,
            prepare_authorized_photo=photo_preparer
            or (lambda data: prepare_photo(data, region_detector=lambda _image: [])),
        )
    )
    return app, calls


@pytest.mark.anyio
async def test_route_requires_auth_and_returns_camel_case_contract():
    app, _ = make_client(provider=FakeProvider(model_suggestion()))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage", json={"description": "فيه حفرة في الشارع"}
        )
    assert response.status_code == 200
    body = response.json()
    assert body["options"][0]["categoryId"] == "pothole"
    assert "source" not in body
    assert "emergency" not in body
    assert body["duplicates"] == []

    unauthenticated, _ = make_client(user_id=None)
    async with AsyncClient(
        transport=ASGITransport(app=unauthenticated), base_url="http://test"
    ) as client:
        assert (
            await client.post("/triage", json={"description": "حفرة"})
        ).status_code == 401


@pytest.mark.anyio
async def test_route_loads_photo_only_after_user_scoped_storage_check():
    app, calls = make_client(provider=FakeProvider(model_suggestion()))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage",
            json={
                "description": "حفرة",
                "photoUri": "citizen-1/a.jpg",
                "photoConsent": True,
            },
        )
    assert response.status_code == 200
    assert calls["photo"] == [("citizen-1/a.jpg", "citizen-1", True)]


@pytest.mark.anyio
async def test_route_omits_photo_from_model_when_free_tier_photo_analysis_is_disabled():
    provider = FakeProvider(model_suggestion())
    app, calls = make_client(provider=provider, photo_analysis_enabled=False)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage", json={"description": "حفرة", "photoUri": "report_photos/a.jpg"}
        )
    assert response.status_code == 200
    assert calls["photo"] == []
    assert provider.calls == 1


@pytest.mark.anyio
async def test_route_requires_explicit_photo_consent_when_analysis_is_enabled():
    provider = FakeProvider(model_suggestion())
    app, calls = make_client(provider=provider)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage", json={"description": "حفرة", "photoUri": "citizen-1/a.jpg"}
        )
    assert response.status_code == 403
    assert calls["photo"] == []
    assert provider.calls == 0


@pytest.mark.anyio
async def test_route_fails_closed_if_privacy_filter_is_unavailable():
    def unavailable(_data):
        raise PrivacyFilterUnavailable("OpenCV unavailable")

    provider = FakeProvider(model_suggestion())
    app, calls = make_client(provider=provider, photo_preparer=unavailable)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage",
            json={
                "description": "حفرة",
                "photoUri": "citizen-1/a.jpg",
                "photoConsent": True,
            },
        )
    assert response.status_code == 503
    assert calls["photo"] == [("citizen-1/a.jpg", "citizen-1", True)]
    assert provider.calls == 0


@pytest.mark.anyio
async def test_route_rejects_arbitrary_urls_before_storage_or_provider_call():
    provider = FakeProvider(model_suggestion())
    app, calls = make_client(provider=provider)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage",
            json={"description": "حفرة", "photoUri": "https://example.com/a.jpg"},
        )
    assert response.status_code == 422
    assert calls["photo"] == []
    assert provider.calls == 0


@pytest.mark.anyio
async def test_route_does_not_call_model_when_photo_is_not_owned():
    async def forbidden(_path, _user_id, _consent):
        raise HTTPException(403, "Forbidden")

    provider = FakeProvider(model_suggestion())
    app, _ = make_client(loader=forbidden, provider=provider)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage",
            json={
                "description": "حفرة",
                "photoUri": "other_user/photo.jpg",
                "photoConsent": True,
            },
        )
    assert response.status_code == 403
    assert provider.calls == 0


@pytest.mark.anyio
async def test_route_applies_geo_duplicate_lookup_to_suggested_categories():
    app, calls = make_client(provider=FakeProvider(model_suggestion()))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/triage",
            json={"description": "حفرة", "location": {"lat": 30.05, "lng": 31.3}},
        )
    assert response.status_code == 200
    assert [args[0] for args in calls["nearby"]] == [
        CategoryId.pothole,
        CategoryId.broken_sidewalk,
        CategoryId.road_obstruction,
    ]
    assert all(args[1:4] == (30.05, 31.3, 250) for args in calls["nearby"])
    assert all(args[4] == "citizen-1" for args in calls["nearby"])
