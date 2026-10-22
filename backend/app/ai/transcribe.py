"""Private Egyptian Arabic voice-note transcription through configured Gemini."""

import asyncio
import base64
import json
import logging
import math
import re
import shutil
import subprocess
import tempfile
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator

from app.ai.schemas import ApiModel, ProviderError

logger = logging.getLogger(__name__)
TRANSCRIPTION_DEADLINE_SECONDS = 5.0
MAX_TRANSCRIPTION_CHARS = 2000
MAX_TRANSCRIPTION_AUDIO_BYTES = 5 * 1024 * 1024
MAX_TRANSCRIPTION_DURATION_SECONDS = 30
FFMPEG_TIMEOUT_SECONDS = 1.75
SILENCE_PEAK_DBFS = -75.0
AUDIO_DURATION_CHECK_SECONDS = MAX_TRANSCRIPTION_DURATION_SECONDS + 0.001
AUDIO_SUFFIXES = {
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
}


@dataclass(frozen=True)
class AudioAnalysis:
    duration_seconds: float
    peak_dbfs: float


def inspect_audio(audio: bytes, mime_type: str) -> AudioAnalysis:
    """Boundedly decode audio to validate duration and reject effectively silent clips.

    Container duration metadata is optional for streamed WebM and can be forged, so
    measure the decoded audio frames rather than trusting the container header.
    """
    executable = shutil.which("ffmpeg")
    suffix = AUDIO_SUFFIXES.get(mime_type)
    if executable is None:
        raise RuntimeError("ffmpeg is required for voice-note validation")
    if suffix is None:
        raise ValueError("unsupported voice-note media type")

    try:
        with tempfile.TemporaryDirectory(prefix="voice-check-") as directory:
            path = Path(directory) / f"voice{suffix}"
            path.write_bytes(audio)
            result = subprocess.run(
                [
                    executable,
                    "-hide_banner",
                    "-nostdin",
                    "-v",
                    "info",
                    "-protocol_whitelist",
                    "file,pipe,data",
                    "-probesize",
                    "1M",
                    "-analyzeduration",
                    "1M",
                    "-threads",
                    "1",
                    "-i",
                    str(path),
                    "-map",
                    "0:a:0",
                    "-t",
                    str(AUDIO_DURATION_CHECK_SECONDS),
                    "-af",
                    f"atrim=duration={AUDIO_DURATION_CHECK_SECONDS},ashowinfo,volumedetect",
                    "-filter_threads",
                    "1",
                    "-f",
                    "null",
                    "-",
                ],
                check=False,
                capture_output=True,
                text=True,
                stdin=subprocess.DEVNULL,
                timeout=FFMPEG_TIMEOUT_SECONDS,
                shell=False,
            )
            if result.returncode != 0:
                raise ValueError("voice note is not valid audio")
            frame_matches = list(
                re.finditer(
                    r"pts_time:([-+]?\d+(?:\.\d+)?)"
                    r"(?=[^\n]*\bnb_samples:(\d+))"
                    r"(?=[^\n]*\brate:(\d+))",
                    result.stderr,
                )
            )
            peak_match = re.search(
                r"max_volume:\s*(-?inf|[-+]?\d+(?:\.\d+)?)\s*dB",
                result.stderr,
                flags=re.IGNORECASE,
            )
            if not frame_matches or peak_match is None:
                raise ValueError("voice-note audio details could not be checked")
            first_pts = float(frame_matches[0].group(1))
            last_frame = frame_matches[-1]
            last_pts = float(last_frame.group(1))
            last_frame_duration = int(last_frame.group(2)) / int(last_frame.group(3))
            duration = last_pts + last_frame_duration - first_pts
            peak_dbfs = float(peak_match.group(1))
    except subprocess.TimeoutExpired as error:
        raise ValueError("voice-note audio check timed out") from error
    except (OSError, TypeError) as error:
        raise ValueError("voice-note audio details could not be checked") from error
    if not math.isfinite(duration) or duration <= 0 or math.isnan(peak_dbfs) or peak_dbfs == math.inf:
        raise ValueError("voice-note audio details could not be checked")
    return AudioAnalysis(duration_seconds=duration, peak_dbfs=peak_dbfs)


class TranscriptionRequest(ApiModel):
    path: str = Field(min_length=3, max_length=512)

    @field_validator("path")
    @classmethod
    def validate_storage_path(cls, value: str) -> str:
        if (
            value.startswith(("/", "\\"))
            or "://" in value
            or "\\" in value
            or any(part in {"", ".", ".."} for part in value.split("/"))
        ):
            raise ValueError("path must be a normalized relative storage path")
        return value


class Transcription(ApiModel):
    text: str = Field(min_length=1, max_length=MAX_TRANSCRIPTION_CHARS)
    language: str = "ar-EG"
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)

    @field_validator("text")
    @classmethod
    def text_is_single_line(cls, value: str) -> str:
        value = re.sub(r"\s+", " ", value).strip()
        if not value:
            raise ValueError("transcription is empty")
        return value

    @field_validator("language")
    @classmethod
    def language_is_egyptian_arabic(cls, value: str) -> str:
        if value != "ar-EG":
            raise ValueError("language must be ar-EG")
        return value


class AudioTranscriber(Protocol):
    async def transcribe(self, audio: bytes, mime_type: str) -> Transcription: ...


class GeminiAudioTranscriber:
    """One-call structured audio transcription; credentials remain server-side."""

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: float = 4.5,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    async def transcribe(self, audio: bytes, mime_type: str) -> Transcription:
        if mime_type not in {"audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg"}:
            raise ProviderError("Unsupported voice-note media type")
        request = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                "Transcribe this Egyptian Arabic voice note verbatim. "
                                "Return concise Arabic-script text, without translation "
                                "or added explanation. If speech is unclear, "
                                "transcribe only the clear words and lower confidence. "
                                "Return language ar-EG and confidence from 0 to 1."
                            )
                        },
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": base64.b64encode(audio).decode("ascii"),
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": 512,
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "OBJECT",
                    "properties": {
                        "text": {"type": "STRING"},
                        "language": {"type": "STRING", "enum": ["ar-EG"]},
                        "confidence": {"type": "NUMBER", "minimum": 0, "maximum": 1},
                    },
                    "required": ["text", "language", "confidence"],
                },
            },
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self.transport) as client:
                response = await client.post(url, headers={"x-goog-api-key": self.api_key}, json=request)
            response.raise_for_status()
            payload = response.json()
            candidate = payload["candidates"][0]
            if candidate.get("finishReason") in {"SAFETY", "RECITATION"}:
                raise ProviderError("Gemini declined the transcription request")
            text = "".join(part.get("text", "") for part in candidate["content"]["parts"])
            return Transcription.model_validate(json.loads(text))
        except ProviderError:
            raise
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
            # Provider bodies may contain user audio or text; never log them.
            raise ProviderError(f"Gemini transcription failed ({type(error).__name__})") from error


CurrentUserDependency = Callable[..., Any]
VoiceLoader = Callable[[str, str], Awaitable[tuple[bytes, str]]]


def create_transcription_router(
    *,
    get_current_user: CurrentUserDependency,
    load_authorized_voice: VoiceLoader,
    provider: AudioTranscriber | None,
) -> APIRouter:
    router = APIRouter(tags=["AI"])

    @router.post(
        "/ai/transcribe",
        response_model=Transcription,
        response_model_by_alias=True,
    )
    async def transcribe_voice_note(
        request: TranscriptionRequest,
        current_user: Any = Depends(get_current_user),
    ) -> Transcription:
        user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", None)
        if not isinstance(user_id, str) or not user_id.strip():
            raise HTTPException(401, "محتاج تسجل دخول الأول")
        if provider is None:
            raise HTTPException(503, "تحويل الصوت لنص مش متاح دلوقتي.")
        loop = asyncio.get_running_loop()
        deadline = loop.time() + TRANSCRIPTION_DEADLINE_SECONDS
        try:
            audio, mime_type = await asyncio.wait_for(
                load_authorized_voice(request.path, user_id),
                timeout=max(0.01, deadline - loop.time()),
            )
        except HTTPException:
            raise
        except asyncio.TimeoutError as error:
            raise HTTPException(504, "التسجيل طويل أو الخدمة اتأخرت؛ اكتب الوصف بنفسك.") from error
        except Exception as error:
            logger.warning("Could not load caller-owned voice note (%s)", type(error).__name__)
            raise HTTPException(404, "التسجيل مش متاح.") from error
        if len(audio) > MAX_TRANSCRIPTION_AUDIO_BYTES:
            raise HTTPException(413, "حجم التسجيل أكبر من المسموح (٥ ميجابايت).")
        try:
            remaining = max(0.01, deadline - loop.time())
            analysis = await asyncio.wait_for(
                asyncio.to_thread(inspect_audio, audio, mime_type),
                timeout=min(FFMPEG_TIMEOUT_SECONDS + 0.25, remaining),
            )
            if analysis.duration_seconds > MAX_TRANSCRIPTION_DURATION_SECONDS:
                raise HTTPException(413, "مدة التسجيل لازم تكون ٣٠ ثانية أو أقل.")
            if analysis.peak_dbfs <= SILENCE_PEAK_DBFS:
                raise HTTPException(422, "مستوى الصوت واطي جدًا؛ اكتب الوصف بنفسك.")
        except HTTPException:
            raise
        except asyncio.TimeoutError as error:
            raise HTTPException(422, "مقدرناش نتحقق من التسجيل؛ جرّب مقطع أقصر أو اكتب الوصف.") from error
        except ValueError as error:
            raise HTTPException(422, "ملف التسجيل غير صالح أو مدته غير واضحة.") from error
        except RuntimeError as error:
            logger.error("Voice duration validation is not configured")
            raise HTTPException(503, "التحقق من التسجيل مش متاح دلوقتي.") from error
        try:
            result = await asyncio.wait_for(
                provider.transcribe(audio, mime_type),
                timeout=max(0.01, deadline - loop.time()),
            )
            return Transcription.model_validate(result.model_dump(mode="json", by_alias=True))
        except asyncio.TimeoutError as error:
            raise HTTPException(504, "التسجيل طويل أو الخدمة اتأخرت؛ اكتب الوصف بنفسك.") from error
        except Exception as error:
            logger.warning("Voice transcription unavailable (%s)", type(error).__name__)
            raise HTTPException(503, "مقدرناش نحوّل التسجيل لنص؛ اكتب الوصف بنفسك.") from error

    return router
