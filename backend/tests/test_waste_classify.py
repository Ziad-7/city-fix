"""POST /ai/waste-classify: Gemini when configured and consented, deterministic fallback otherwise."""

import io
import json

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.ai.waste import GeminiWasteClassifier, create_waste_router, fallback_result
from app.auth import User


def photo_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(buf, "JPEG")
    return buf.getvalue()


def make_client(classifier=None, enabled=True, loader=None):
    async def default_loader(path, user_id, consent):
        return photo_bytes()

    app = FastAPI()
    app.include_router(
        create_waste_router(
            get_current_user=lambda: User(id="u1", phone="+20"),
            load_authorized_photo=loader or default_loader,
            classifier=classifier,
            photo_analysis_enabled=enabled,
        )
    )
    return TestClient(app)


def gemini(payload: dict | None = None, status=200):
    def handler(request: httpx.Request) -> httpx.Response:
        if status != 200:
            return httpx.Response(status)
        text = json.dumps(payload)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})

    return GeminiWasteClassifier("k", "m", transport=httpx.MockTransport(handler))


GOOD = {
    "materials": [{"materialId": "glass", "confidence": 0.8}, {"materialId": "bogus", "confidence": 0.9}],
    "size": "large",
}


def test_fallback_without_provider_has_contract_shape():
    r = make_client().post("/ai/waste-classify", json={"path": "photos/u1/a.jpg"})
    assert r.status_code == 200
    assert r.json() == {"materials": [], "size": "medium", "estimatedKgRange": [3.0, 10.0], "source": "fallback"}


def test_fallback_uses_text_hint():
    r = make_client().post("/ai/waste-classify", json={"path": "p", "description": "ازايز وعلب صفيح وكرتون"})
    ids = [m["materialId"] for m in r.json()["materials"]]
    assert set(ids) <= {"glass", "metal_cans", "paper_cardboard"} and ids and r.json()["source"] == "fallback"
    assert fallback_result("")["materials"] == []


def test_model_used_only_with_consent_and_enabled():
    client = make_client(gemini(GOOD))
    assert client.post("/ai/waste-classify", json={"path": "p"}).json()["source"] == "fallback"
    r = client.post("/ai/waste-classify", json={"path": "p", "photoConsent": True}).json()
    assert r["source"] == "model" and r["size"] == "large"
    assert r["materials"] == [{"materialId": "glass", "confidence": 0.8}]  # unknown material dropped
    off = make_client(gemini(GOOD), enabled=False)
    assert off.post("/ai/waste-classify", json={"path": "p", "photoConsent": True}).json()["source"] == "fallback"


def test_provider_and_storage_failures_fall_back_without_error():
    body = {"path": "p", "photoConsent": True}
    assert make_client(gemini(status=500)).post("/ai/waste-classify", json=body).json()["source"] == "fallback"
    assert (
        make_client(gemini({"materials": [], "size": "huge"})).post("/ai/waste-classify", json=body).status_code == 200
    )

    async def broken(path, user_id, consent):
        raise RuntimeError("storage down")

    r = make_client(gemini(GOOD), loader=broken).post("/ai/waste-classify", json=body)
    assert r.status_code == 200 and r.json()["source"] == "fallback"


def test_route_mounted_in_app_and_authenticated(client, citizen_h):
    assert client.post("/ai/waste-classify", json={"path": "p"}).status_code == 401
    r = client.post("/ai/waste-classify", json={"path": "photos/x.jpg"}, headers=citizen_h)
    assert r.status_code == 200 and r.json()["source"] == "fallback"


def test_waste_classifier_request_uses_canonical_prompt_contract():
    import asyncio

    from app.ai.waste import waste_prompt_contract

    requests = []

    async def handle(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(GOOD)}]}}]})

    classifier = GeminiWasteClassifier("k", "m", transport=httpx.MockTransport(handle))
    asyncio.run(classifier.classify(b"fixture-photo"))
    payload = requests[0]
    contract = waste_prompt_contract()
    assert payload["contents"][0]["parts"][0]["text"] == contract["prompt"]
    assert payload["generationConfig"] == contract["generationConfig"]
