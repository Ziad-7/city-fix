import base64
import json

import httpx
import pytest

from app.ai.llm import GeminiClient
from app.ai.schemas import CategoryId, ProviderError


def gemini_response(options=None):
    if options is None:
        options = [
            {"categoryId": "pothole", "confidence": 0.8},
            {"categoryId": "broken_sidewalk", "confidence": 0.15},
            {"categoryId": "road_obstruction", "confidence": 0.05},
        ]
    return {
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {
                    "parts": [
                        {
                            "text": json.dumps(
                                {
                                    "options": options,
                                    "severity": "medium",
                                    "summary": "اقتراح: حفرة في الطريق، يُرجى المراجعة.",
                                }
                            )
                        }
                    ]
                },
            }
        ]
    }


@pytest.mark.anyio
async def test_gemini_sends_text_image_and_strict_schema_to_selected_free_model():
    seen = {}

    async def handle(request):
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=gemini_response())

    transport = httpx.MockTransport(handle)
    client = GeminiClient(api_key="server-secret", transport=transport)
    result = await client.suggest(
        description="فيه حفرة قدام المدرسة",
        photo_bytes=b"normalized-jpeg",
        photo_mime_type="image/jpeg",
        category_hint=CategoryId.pothole,
    )

    assert "/models/gemini-3.5-flash-lite:generateContent" in seen["url"]
    assert seen["key"] == "server-secret"
    config = seen["body"]["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    assert config["responseSchema"]["properties"]["options"]["items"]["properties"][
        "categoryId"
    ]["enum"]
    parts = seen["body"]["contents"][0]["parts"]
    assert "حفرة قدام المدرسة" in parts[0]["text"]
    assert "untrusted" in parts[0]["text"]
    assert base64.b64decode(parts[1]["inlineData"]["data"]) == b"normalized-jpeg"
    assert result.options[0].category_id == CategoryId.pothole


@pytest.mark.anyio
async def test_gemini_refusal_and_provider_http_errors_raise_safe_errors():
    async def refused(_request):
        return httpx.Response(
            200,
            json={"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]},
        )

    client = GeminiClient(api_key="x", transport=httpx.MockTransport(refused))
    with pytest.raises(ProviderError, match="declined"):
        await client.suggest(
            description="text",
            photo_bytes=None,
            photo_mime_type=None,
            category_hint=None,
        )

    async def rate_limited(_request):
        return httpx.Response(429, text="private provider body")

    client = GeminiClient(api_key="x", transport=httpx.MockTransport(rate_limited))
    with pytest.raises(ProviderError) as error:
        await client.suggest(
            description="text",
            photo_bytes=None,
            photo_mime_type=None,
            category_hint=None,
        )
    assert "private provider body" not in str(error.value)


@pytest.mark.anyio
async def test_malformed_model_json_is_rejected():
    async def malformed(_request):
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": "not-json"}]},
                    }
                ]
            },
        )

    client = GeminiClient(api_key="x", transport=httpx.MockTransport(malformed))
    with pytest.raises(ProviderError):
        await client.suggest(
            description="text",
            photo_bytes=None,
            photo_mime_type=None,
            category_hint=None,
        )
