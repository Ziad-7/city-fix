import asyncio
from dataclasses import dataclass

import pytest

from app.ai.keywords import classify_keywords, detect_emergency, normalize_ar
from app.ai.schemas import CategoryId, ModelSuggestion, Severity, TriageSuggestion
from app.ai.triage import analyze_report


def test_normalize_arabic_and_classify_pothole_with_school_context():
    assert normalize_ar("الأسفلت مكسورة ى") == "الاسفلت مكسوره ي"
    result = classify_keywords("فيه حفرة كبيرة قدام المدرسة والعربيات بتقع فيها كل يوم")
    assert result.options[0].category_id == CategoryId.pothole
    assert result.severity == Severity.high
    assert "حفرة" in result.summary
    assert result.source == "fallback"


def test_keyword_result_is_top_three_sorted_and_confidence_sum_is_bounded():
    result = classify_keywords("زبالة متراكمة وكلاب ضالة جنبها", CategoryId.garbage)
    assert len(result.options) == 3
    assert result.options[0].category_id == CategoryId.garbage
    assert [o.confidence for o in result.options] == sorted((o.confidence for o in result.options), reverse=True)
    assert sum(o.confidence for o in result.options) <= 1


@pytest.mark.parametrize(
    "description",
    [
        "فيه ريحة غاز جامدة في السلم",
        "حريقة في المحل اللي جنبنا",
        "حد اتعور في الحادثة",
        "السقف وقع على الناس",
        "تسريب غاز",
    ],
)
def test_emergency_terms_are_detected_independently(description):
    assert detect_emergency(description)
    result = classify_keywords(description)
    assert result.emergency is True
    assert result.severity == Severity.critical


def test_non_emergency_pothole_language_does_not_trigger_emergency():
    assert not detect_emergency("فيه حفرة والعربيات بتقع فيها كل يوم")
    assert not detect_emergency("بيهدموا العمارة اللي قدام البيت")


@dataclass
class FakeProvider:
    result: ModelSuggestion | dict | Exception
    calls: int = 0

    async def suggest(self, **_kwargs):
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def model_suggestion(**overrides):
    values = {
        "options": [
            {"categoryId": "pothole", "confidence": 0.8},
            {"categoryId": "broken_sidewalk", "confidence": 0.15},
            {"categoryId": "road_obstruction", "confidence": 0.05},
        ],
        "severity": "medium",
        "summary": "اقتراح: حفرة في الطريق، يُرجى المراجعة.",
    }
    values.update(overrides)
    return ModelSuggestion.model_validate(values)


def test_model_result_receives_source_and_emergency_rules_are_preserved():
    provider = FakeProvider(model_suggestion())
    result = asyncio.run(analyze_report(provider, "فيه حفرة في الشارع"))
    assert result.source == "model"
    assert result.options[0].category_id == CategoryId.pothole
    assert result.emergency is False
    assert provider.calls == 1

    emergency_provider = FakeProvider(model_suggestion(severity="low"))
    urgent = asyncio.run(analyze_report(emergency_provider, "فيه ريحة غاز جنب البدروم"))
    assert urgent.emergency is True
    assert urgent.severity == Severity.critical


@pytest.mark.parametrize(
    "bad_suggestion",
    [
        {
            "options": [{"categoryId": "not_a_category", "confidence": 1}],
            "severity": "low",
            "summary": "x",
        },
        {
            "options": [
                {"categoryId": "pothole", "confidence": 0.8},
                {"categoryId": "garbage", "confidence": 0.4},
                {"categoryId": "other", "confidence": 0.1},
            ],
            "severity": "low",
            "summary": "x",
        },
        {
            "options": [
                {"categoryId": "pothole", "confidence": float("nan")},
                {"categoryId": "garbage", "confidence": 0.1},
                {"categoryId": "other", "confidence": 0.1},
            ],
            "severity": "low",
            "summary": "x",
        },
    ],
)
def test_invalid_model_output_uses_deterministic_fallback(bad_suggestion):
    result = asyncio.run(analyze_report(FakeProvider(bad_suggestion), "حفرة في الشارع"))
    assert result.source == "fallback"
    assert result.options[0].category_id == CategoryId.pothole


def test_provider_failure_and_timeout_fall_back():
    failed = asyncio.run(analyze_report(FakeProvider(RuntimeError("429 quota")), "حفرة في الشارع"))
    assert failed.source == "fallback"

    class SlowProvider:
        async def suggest(self, **_kwargs):
            await asyncio.sleep(0.1)
            return model_suggestion()

    timed_out = asyncio.run(analyze_report(SlowProvider(), "حفرة في الشارع", timeout_seconds=0.01))
    assert timed_out.source == "fallback"


def test_user_category_hint_remains_in_top_three_and_can_become_first():
    result = classify_keywords("مشكلة", CategoryId.streetlight_out)
    assert result.options[0].category_id == CategoryId.streetlight_out


def test_response_rejects_bad_confidence_contract():
    with pytest.raises(ValueError):
        TriageSuggestion.model_validate(
            {
                "options": [{"categoryId": "pothole", "confidence": 1.2}],
                "severity": "low",
                "summary": "x",
                "duplicates": [],
                "source": "model",
                "emergency": False,
            }
        )
