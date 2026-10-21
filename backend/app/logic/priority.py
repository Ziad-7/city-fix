"""Priority calculation logic - ported from mobile app."""
from typing import TypedDict


class PriorityInput(TypedDict):
    """Priority calculation input."""

    severity: str  # low, medium, high, critical
    near_sensitive_place: bool
    reporters: int
    days_open: int
    target_days: int
    area_underserved: bool


class PriorityFactor(TypedDict):
    """A single factor contributing to priority score."""

    key: str
    label: str
    points: int
    max: int


class Priority(TypedDict):
    """Priority score and factors."""

    score: int
    factors: list[PriorityFactor]


SEVERITY_POINTS = {"low": 5, "medium": 15, "high": 28, "critical": 40}
MAX = {"severity": 40, "sensitive": 20, "reporters": 20, "age": 15, "equity": 5}


def compute_priority(inp: PriorityInput) -> Priority:
    """
    Deterministic priority score 0-100.
    Every factor is returned with an Arabic label and its points.
    """
    reporters = max(1, int(inp["reporters"]))
    ratio = inp["days_open"] / inp["target_days"] if inp["target_days"] > 0 else 0

    factors: list[PriorityFactor] = [
        {
            "key": "severity",
            "label": "خطورة المشكلة",
            "points": SEVERITY_POINTS[inp["severity"]],
            "max": MAX["severity"],
        },
        {
            "key": "sensitive",
            "label": "قريب من مدرسة أو مستشفى",
            "points": MAX["sensitive"] if inp["near_sensitive_place"] else 0,
            "max": MAX["sensitive"],
        },
        {
            "key": "reporters",
            "label": "عدد المواطنين اللي بلّغوا",
            "points": min(MAX["reporters"], (reporters - 1) * 3),
            "max": MAX["reporters"],
        },
        {
            "key": "age",
            "label": "مدة الانتظار مقارنة بالمستهدف",
            "points": min(MAX["age"], int(ratio * 10 + 0.5)),  # JS Math.round semantics
            "max": MAX["age"],
        },
        {
            "key": "equity",
            "label": "منطقة محتاجة اهتمام أكتر",
            "points": MAX["equity"] if inp["area_underserved"] else 0,
            "max": MAX["equity"],
        },
    ]
    score = min(100, sum(f["points"] for f in factors))
    return {"score": score, "factors": factors}


def priority_level(score: int) -> str:
    """Map score to priority level."""
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


PRIORITY_LABEL_AR = {
    "critical": "أولوية عاجلة",
    "high": "أولوية عالية",
    "medium": "أولوية متوسطة",
    "low": "أولوية عادية",
}
