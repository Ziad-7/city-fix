import asyncio
import logging
from typing import Any, Protocol

from app.ai.keywords import (
    CATEGORY_LABELS,
    DEPARTMENTS,
    classify_keywords,
    detect_emergency,
)
from app.ai.schemas import CategoryId, ModelSuggestion, Severity, TriageSuggestion

logger = logging.getLogger(__name__)


class SuggestionProvider(Protocol):
    async def suggest(
        self,
        *,
        description: str,
        photo_bytes: bytes | None,
        photo_mime_type: str | None,
        category_hint: CategoryId | None,
    ) -> ModelSuggestion | dict[str, Any]: ...


def _validate_model_result(result: ModelSuggestion | dict[str, Any], description: str) -> TriageSuggestion:
    # Revalidate even injected/provider objects: a malformed provider response must never leak through.
    payload = result.model_dump(mode="json", by_alias=True) if isinstance(result, ModelSuggestion) else result
    result = ModelSuggestion.model_validate(payload)
    top = result.options[0].category_id
    severity = result.severity
    if top in {CategoryId.open_manhole, CategoryId.exposed_wire} and severity in {
        Severity.low,
        Severity.medium,
    }:
        severity = Severity.high
    emergency = detect_emergency(description)
    if emergency:
        severity = Severity.critical
    return TriageSuggestion(
        options=result.options,
        summary=(
            result.summary
            if not emergency
            else f"بلاغ طارئ محتاج تدخل سريع؛ {CATEGORY_LABELS[top]} — {DEPARTMENTS[top]}."
        ),
        severity=severity,
        duplicates=[],
        source="model",
        emergency=emergency,
    )


async def analyze_report(
    provider: SuggestionProvider | None,
    description: str,
    *,
    photo_bytes: bytes | None = None,
    photo_mime_type: str | None = None,
    category_hint: CategoryId | None = None,
    timeout_seconds: float = 4.0,
) -> TriageSuggestion:
    fallback = classify_keywords(description, category_hint)
    if provider is None:
        return fallback
    try:
        result = await asyncio.wait_for(
            provider.suggest(
                description=description,
                photo_bytes=photo_bytes,
                photo_mime_type=photo_mime_type,
                category_hint=category_hint,
            ),
            timeout=timeout_seconds,
        )
        return _validate_model_result(result, description)
    except Exception as error:
        logger.warning(
            "AI triage unavailable; returning keyword fallback (%s)",
            type(error).__name__,
        )
        return fallback
