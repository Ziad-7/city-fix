from dataclasses import dataclass

from fastapi import FastAPI, HTTPException
import httpx
from httpx import ASGITransport, AsyncClient
import pytest

from app.ai.schemas import ProviderError
from app.ai.transcribe import (
    GeminiAudioTranscriber,
    Transcription,
    create_transcription_router,
)


@dataclass
class User:
    id: str


@pytest.mark.anyio
async def test_transcription_route_reads_only_the_callers_voice_note():
    calls = []

    async def authenticate():
        return User("citizen-1")

    async def load_voice(path, user_id):
        calls.append((path, user_id))
        return b"audio", "audio/mp4"

    class Provider:
        async def transcribe(self, audio, mime_type):
            assert audio == b"audio"
            assert mime_type == "audio/mp4"
            return Transcription(
                text="فيه حفرة", language="ar-EG", confidence=0.91
            )

    app = FastAPI()
    app.include_router(
        create_transcription_router(
            get_current_user=authenticate,
            load_authorized_voice=load_voice,
            provider=Provider(),
        )
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/ai/transcribe", json={"path": "citizen-1/voice.m4a"}
        )

    assert response.status_code == 200
    assert response.json() == {
        "text": "فيه حفرة",
        "language": "ar-EG",
        "confidence": 0.91,
    }
    assert calls == [("citizen-1/voice.m4a", "citizen-1")]


@pytest.mark.anyio
async def test_transcription_route_does_not_call_provider_for_another_users_path():
    async def authenticate():
        return User("citizen-1")

    async def load_voice(_path, _user_id):
        raise HTTPException(403, "Forbidden")

    class Provider:
        async def transcribe(self, _audio, _mime_type):
            raise AssertionError("provider must not receive an unowned recording")

    app = FastAPI()
    app.include_router(
        create_transcription_router(
            get_current_user=authenticate,
            load_authorized_voice=load_voice,
            provider=Provider(),
        )
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/ai/transcribe", json={"path": "someone-else/voice.m4a"}
        )

    assert response.status_code == 403


@pytest.mark.anyio
async def test_transcription_route_rejects_public_urls_and_missing_provider():
    async def authenticate():
        return User("citizen-1")

    async def load_voice(_path, _user_id):
        return b"audio", "audio/mp4"

    app = FastAPI()
    app.include_router(
        create_transcription_router(
            get_current_user=authenticate,
            load_authorized_voice=load_voice,
            provider=None,
        )
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        invalid = await client.post(
            "/ai/transcribe", json={"path": "https://example.com/voice.m4a"}
        )
        unavailable = await client.post(
            "/ai/transcribe", json={"path": "citizen-1/voice.m4a"}
        )

    assert invalid.status_code == 422
    assert unavailable.status_code == 503


@pytest.mark.anyio
async def test_gemini_transcriber_sends_audio_and_validates_arabic_output():
    requests = []

    async def handle(request):
        requests.append(request)
        result = '{"text":"فيه حفرة","language":"ar-EG","confidence":0.9}'
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": result}]}}]},
        )

    provider = GeminiAudioTranscriber(
        api_key="secret",
        model="gemini-test",
        transport=httpx.MockTransport(handle),
    )
    result = await provider.transcribe(b"voice-bytes", "audio/mp4")

    assert result == Transcription(
        text="فيه حفرة", language="ar-EG", confidence=0.9
    )
    assert requests[0].headers["x-goog-api-key"] == "secret"
    sent = requests[0].read().decode()
    assert "dm9pY2UtYnl0ZXM=" in sent
    assert "audio/mp4" in sent


@pytest.mark.anyio
async def test_gemini_transcriber_rejects_unsupported_audio_type():
    provider = GeminiAudioTranscriber(api_key="secret", model="gemini-test")
    with pytest.raises(ProviderError, match="Unsupported voice-note media type"):
        await provider.transcribe(b"voice", "application/octet-stream")
