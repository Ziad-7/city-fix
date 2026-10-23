from dataclasses import dataclass
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.ai.schemas import ProviderError
from app.ai.transcribe import (
    MAX_TRANSCRIPTION_AUDIO_BYTES,
    MAX_TRANSCRIPTION_DURATION_SECONDS,
    AudioAnalysis,
    GeminiAudioTranscriber,
    Transcription,
    create_transcription_router,
    inspect_audio,
)


@dataclass
class User:
    id: str


@pytest.mark.anyio
async def test_transcription_route_reads_only_the_callers_voice_note(monkeypatch):
    async def inspect_in_process(callback, *args):
        return callback(*args)

    monkeypatch.setattr("app.ai.transcribe.asyncio.to_thread", inspect_in_process)
    monkeypatch.setattr(
        "app.ai.transcribe.inspect_audio",
        lambda *_: AudioAnalysis(duration_seconds=2.0, peak_dbfs=-30.0),
    )
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
            return Transcription(text="فيه حفرة", language="ar-EG", confidence=0.91)

    app = FastAPI()
    app.include_router(
        create_transcription_router(
            get_current_user=authenticate,
            load_authorized_voice=load_voice,
            provider=Provider(),
        )
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/ai/transcribe", json={"path": "citizen-1/voice.m4a"})

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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/ai/transcribe", json={"path": "someone-else/voice.m4a"})

    assert response.status_code == 403


@pytest.mark.anyio
async def test_transcription_route_rejects_oversized_audio_before_provider():
    async def authenticate():
        return User("citizen-1")

    async def load_voice(_path, _user_id):
        return b"x" * (MAX_TRANSCRIPTION_AUDIO_BYTES + 1), "audio/mp4"

    class Provider:
        async def transcribe(self, _audio, _mime_type):
            raise AssertionError("oversized audio must not reach provider")

    app = FastAPI()
    app.include_router(
        create_transcription_router(
            get_current_user=authenticate,
            load_authorized_voice=load_voice,
            provider=Provider(),
        )
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/ai/transcribe", json={"path": "citizen-1/voice.m4a"})

    assert response.status_code == 413


@pytest.mark.anyio
async def test_transcription_route_rejects_long_audio_before_provider(monkeypatch):
    async def inspect_in_process(callback, *args):
        return callback(*args)

    monkeypatch.setattr("app.ai.transcribe.asyncio.to_thread", inspect_in_process)
    monkeypatch.setattr(
        "app.ai.transcribe.inspect_audio",
        lambda *_: AudioAnalysis(duration_seconds=31.0, peak_dbfs=-30.0),
    )

    async def authenticate():
        return User("citizen-1")

    async def load_voice(_path, _user_id):
        return b"audio", "audio/mp4"

    class Provider:
        async def transcribe(self, _audio, _mime_type):
            raise AssertionError("long audio must not reach provider")

    app = FastAPI()
    app.include_router(
        create_transcription_router(
            get_current_user=authenticate,
            load_authorized_voice=load_voice,
            provider=Provider(),
        )
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/ai/transcribe", json={"path": "citizen-1/voice.m4a"})

    assert response.status_code == 413


def test_audio_analysis_uses_bounded_ffmpeg(monkeypatch):
    calls = []

    def run(command, **kwargs):
        calls.append((command, kwargs))
        return SimpleNamespace(
            returncode=0,
            stderr=(
                "[Parsed_ashowinfo_0] n:0 pts:0 pts_time:0.0000 rate:48000 "
                "nb_samples:1000\n"
                "[Parsed_ashowinfo_0] n:599 pts:599000 pts_time:12.4792 "
                "rate:48000 nb_samples:1000\n"
                "max_volume: -55.0 dB"
            ),
        )

    monkeypatch.setattr("app.ai.transcribe.shutil.which", lambda _name: "/usr/bin/ffmpeg")
    monkeypatch.setattr("app.ai.transcribe.subprocess.run", run)

    analysis = inspect_audio(b"voice", "audio/mp4")
    assert analysis.duration_seconds == pytest.approx(12.5, abs=0.0001)
    assert analysis.peak_dbfs == -55.0
    command, options = calls[0]
    assert command[0] == "/usr/bin/ffmpeg"
    assert any("volumedetect" in arg for arg in command)
    assert any("ashowinfo" in arg for arg in command)
    assert "30.001" in command
    assert options["timeout"] <= 2
    assert options["shell"] is False
    assert command[command.index("-i") + 1].endswith(".m4a")


def test_audio_analysis_rejects_missing_ffmpeg(monkeypatch):
    monkeypatch.setattr("app.ai.transcribe.shutil.which", lambda _name: None)
    with pytest.raises(RuntimeError, match="ffmpeg is required"):
        inspect_audio(b"voice", "audio/mp4")


def test_transcription_limits_match_recorder_contract():
    assert MAX_TRANSCRIPTION_DURATION_SECONDS == 30


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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        invalid = await client.post("/ai/transcribe", json={"path": "https://example.com/voice.m4a"})
        unavailable = await client.post("/ai/transcribe", json={"path": "citizen-1/voice.m4a"})

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

    assert result == Transcription(text="فيه حفرة", language="ar-EG", confidence=0.9)
    assert requests[0].headers["x-goog-api-key"] == "secret"
    sent = requests[0].read().decode()
    assert "dm9pY2UtYnl0ZXM=" in sent
    assert "audio/mp4" in sent
    assert "Transcribe this Egyptian Arabic voice note verbatim." in sent
    assert 'maxOutputTokens":512' in sent


@pytest.mark.anyio
async def test_gemini_transcriber_rejects_unsupported_audio_type():
    provider = GeminiAudioTranscriber(api_key="secret", model="gemini-test")
    with pytest.raises(ProviderError, match="Unsupported voice-note media type"):
        await provider.transcribe(b"voice", "application/octet-stream")
