from ai_eval.run_eval import score_cases
from app.ai.schemas import TriageSuggestion


def test_score_cases_reports_top_one_top_three_severity_and_fallback():
    cases = [
        {"categoryId": "pothole", "severity": "medium"},
        {"categoryId": "garbage", "severity": "low"},
    ]
    predictions = [
        TriageSuggestion.model_validate(
            {
                "options": [
                    {"categoryId": "pothole", "confidence": 0.8},
                    {"categoryId": "garbage", "confidence": 0.1},
                    {"categoryId": "other", "confidence": 0.05},
                ],
                "severity": "medium",
                "summary": "حفرة في الطريق",
                "duplicates": [],
                "source": "fallback",
            }
        ),
        TriageSuggestion.model_validate(
            {
                "options": [
                    {"categoryId": "pothole", "confidence": 0.5},
                    {"categoryId": "other", "confidence": 0.3},
                    {"categoryId": "garbage", "confidence": 0.2},
                ],
                "severity": "medium",
                "summary": "زبالة متراكمة",
                "duplicates": [],
                "source": "model",
            }
        ),
    ]

    scores = score_cases(cases, predictions)

    assert scores["samples"] == 2
    assert scores["top1Accuracy"] == 0.5
    assert scores["top3Accuracy"] == 1.0
    assert scores["severityAgreement"] == 0.5
    assert scores["fallbackRate"] == 0.5
