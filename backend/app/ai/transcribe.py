"""Private Egyptian Arabic voice-note transcription through configured Gemini."""

import asyncio
import base64
import json
import logging
import re
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator

from app.ai.schemas import ApiModel, ProviderError

logger = logging.getLogger(__name__)
TRANSCRIPTION_DEADLINE_SECONDS = 5.0
MAX_TRANSCRIPTION_CHARS = 2000


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
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent"
        )
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds, transport=self.transport
            ) as client:
                response = await client.post(
                    url, headers={"x-goog-api-key": self.api_key}, json=request
                )
            response.raise_for_status()
            payload = response.json()
            candidate = payload["candidates"][0]
            if candidate.get("finishReason") in {"SAFETY", "RECITATION"}:
                raise ProviderError("Gemini declined the transcription request")
            text = "".join(
                part.get("text", "") for part in candidate["content"]["parts"]
            )
            return Transcription.model_validate(json.loads(text))
        except ProviderError:
            raise
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
            # Provider bodies may contain user audio or text; never log them.
            raise ProviderError(
                f"Gemini transcription failed ({type(error).__name__})"
            ) from error


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
        user_id = (
            current_user
            if isinstance(current_user, str)
            else getattr(current_user, "id", None)
        )
        if not isinstance(user_id, str) or not user_id.strip():
            raise HTTPException(401, "محتاج تسجل دخول الأول")
        if provider is None:
            raise HTTPException(
                503, "تحويل الصوت لنص مش متاح دلوقتي."
            )
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
            raise HTTPException(
                504, "التسجيل طويل أو الخدمة اتأخرت؛ اكتب الوصف بنفسك."
            ) from error
        except Exception as error:
            logger.warning(
                "Could not load caller-owned voice note (%s)", type(error).__name__
            )
            raise HTTPException(404, "التسجيل مش متاح.") from error
        try:
            result = await asyncio.wait_for(
                provider.transcribe(audio, mime_type),
                timeout=max(0.01, deadline - loop.time()),
            )
            return Transcription.model_validate(
                result.model_dump(mode="json", by_alias=True)
            )
        except asyncio.TimeoutError as error:
            raise HTTPException(
                504, "التسجيل طويل أو الخدمة اتأخرت؛ اكتب الوصف بنفسك."
            ) from error
        except Exception as error:
            logger.warning("Voice transcription unavailable (%s)", type(error).__name__)
            raise HTTPException(
                503, "مقدرناش نحوّل التسجيل لنص؛ اكتب الوصف بنفسك."
            ) from error

    return router
