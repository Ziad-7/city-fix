import asyncio
import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.ai.image import InvalidPhotoError, PrivacyFilterUnavailable, prepare_photo
from app.ai.llm import GeminiClient
from app.ai.schemas import CategoryId, TriageRequest, TriageSuggestion
from app.ai.triage import SuggestionProvider, analyze_report

logger = logging.getLogger(__name__)

CurrentUserDependency = Callable[..., Any]
PhotoLoader = Callable[[str, str, bool], Awaitable[bytes]]
PhotoPreparer = Callable[[bytes], bytes]
NearbyLookup = Callable[[CategoryId, float, float, float, str], Awaitable[dict[str, list[dict]]]]
TRIAGE_DEADLINE_SECONDS = 4.0


def create_triage_router(
    *,
    get_current_user: CurrentUserDependency,
    load_authorized_photo: PhotoLoader,
    find_nearby_incidents: NearbyLookup,
    provider: SuggestionProvider | None = None,
    photo_analysis_enabled: bool | None = None,
    prepare_authorized_photo: PhotoPreparer = prepare_photo,
) -> APIRouter:
    """Create the route with required auth/storage/query seams supplied by the API owner.

    There are deliberately no permissive defaults for authentication or photo access. The
    storage callback must enforce the current user's ownership and consent; the local image
    processor must redact before the bytes reach the provider. Photo analysis is disabled by
    default because Gemini's free tier may use submitted content to improve Google products.
    """
    router = APIRouter()
    model_provider = provider if provider is not None else GeminiClient.from_env()
    analyze_photos = photo_analysis_enabled
    if analyze_photos is None:
        analyze_photos = os.getenv("GEMINI_PHOTO_ANALYSIS_ENABLED", "false").lower() == "true"

    @router.post(
        "/triage",
        response_model=TriageSuggestion,
        response_model_by_alias=True,
    )
    async def triage(
        request: TriageRequest,
        current_user: Any = Depends(get_current_user),
    ) -> TriageSuggestion:
        user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", None)
        if not isinstance(user_id, str) or not user_id.strip():
            raise HTTPException(status_code=401, detail="محتاج تسجل دخول الأول")

        photo_bytes: bytes | None = None
        photo_mime_type: str | None = None
        if request.photo_uri and analyze_photos:
            if not request.photo_consent:
                raise HTTPException(
                    status_code=403,
                    detail="لازم توافق على تحليل الصورة بالذكاء الاصطناعي.",
                )
            try:
                raw_photo = await load_authorized_photo(request.photo_uri, user_id, request.photo_consent)
                photo_bytes = prepare_authorized_photo(raw_photo)
                photo_mime_type = "image/jpeg"
            except HTTPException:
                raise
            except InvalidPhotoError as error:
                raise HTTPException(status_code=400, detail="الصورة مش واضحة أو حجمها كبير") from error
            except PrivacyFilterUnavailable as error:
                raise HTTPException(status_code=503, detail="فلتر خصوصية الصور مش متاح دلوقتي.") from error
            except Exception as error:
                logger.warning(
                    "Could not load caller-owned triage photo (%s)",
                    type(error).__name__,
                )
                raise HTTPException(status_code=404, detail="الصورة مش متاحة") from error

        loop = asyncio.get_running_loop()
        deadline = loop.time() + TRIAGE_DEADLINE_SECONDS
        suggestion = await analyze_report(
            model_provider,
            request.description,
            photo_bytes=photo_bytes,
            photo_mime_type=photo_mime_type,
            category_hint=request.category_id,
            timeout_seconds=max(0.01, deadline - loop.time()),
        )

        categories = list(
            dict.fromkeys(
                [option.category_id for option in suggestion.options]
                + ([request.category_id] if request.category_id else [])
            )
        )
        duplicates: dict[str, dict] = {}
        already_reported: dict[str, dict] = {}
        if request.location:
            for category_id in categories:
                remaining = deadline - loop.time()
                if remaining <= 0:
                    break
                try:
                    result = await asyncio.wait_for(
                        find_nearby_incidents(
                            category_id,
                            request.location.lat,
                            request.location.lng,
                            250,
                            user_id,
                        ),
                        timeout=remaining,
                    )
                    for item in result.get("duplicates", []):
                        duplicates[item["incidentId"]] = item
                    for item in result.get("alreadyReported", []):
                        already_reported[item["incidentId"]] = item
                except Exception as error:
                    logger.warning("Nearby incident lookup unavailable (%s)", type(error).__name__)
                    break

        duplicate_items = sorted(duplicates.values(), key=lambda item: item["distanceM"])
        own_items = sorted(already_reported.values(), key=lambda item: item["distanceM"])
        values = suggestion.model_dump()
        values["duplicates"] = duplicate_items
        values["already_reported"] = own_items
        return TriageSuggestion.model_validate(values)

    return router
