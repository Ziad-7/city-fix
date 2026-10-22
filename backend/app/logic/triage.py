"""Deterministic keyword triage: port of apps/mobile/src/logic/triage-mock.ts.

Duplicates / already-reported matches come from the database (see ``routers/triage.py``).
"""

import math
import re

from app.logic.timeline import SEVERITY_LABEL_AR
from app.models import Category

SEVERITIES = ["low", "medium", "high", "critical"]

# Egyptian-Arabic keyword stems per category (matched as substrings after normalisation).
KEYWORDS: dict[str, list[str]] = {
    "pothole": ["حفره", "حفر", "مطب", "اسفلت", "الاسفلت", "نتوء", "العربيات بتقع", "هبوط"],
    "open_manhole": ["بلوعه", "بالوعه", "غطا", "غطاء", "مطبق", "منهول", "مفتوحه"],
    "sewage_overflow": ["طفح", "مجاري", "صرف", "ريحه مجاري", "مياه سوده", "غرقان", "بيطفح"],
    "water_pipe_burst": ["ماسوره", "مواسير", "كسر", "مياه بتطلع", "مايه", "ميه", "تسريب", "بتنزل مياه", "غرق"],
    "garbage": ["زبال", "قمام", "مخلفات", "القمامه", "نفايات", "تلال", "كوم"],
    "streetlight_out": ["عمود نور", "نور", "انار", "مطفي", "ضلمه", "مضلم", "لمبه", "كشاف"],
    "exposed_wire": ["سلك", "اسلاك", "كهربا", "كهرباء", "شرر", "صعق", "كابل", "عريان", "مكشوف"],
    "road_obstruction": ["اشغال", "اشغالات", "تعدي", "كراسي", "بياعين", "سد الطريق", "مقفول", "عربيه واقفه", "صف تاني"],
    "stray_dogs": ["كلب", "كلاب", "ضاله", "ضالة", "بتعض", "نباح"],
    "fallen_tree": ["شجره", "شجر", "فرع", "مايله", "واقعه", "وقعت"],
    "broken_sidewalk": ["رصيف", "بلاط", "مكسور", "الرصيف", "بلاطه"],
    "other": [],
}

ESCALATE = [
    "مدرسه", "مدرسة", "اطفال", "عيال", "طلاب", "مستشفي", "ناس بتقع", "حادث", "خطر", "شرر", "مات",
    "وقع حد", "بتقع كل يوم", "عاجل",
]  # fmt: skip
DE_ESCALATE = ["بسيطه", "صغيره", "خفيفه"]

# Mentions of gas, fire, injury or collapse (contract: proposed `emergency` flag).
EMERGENCY = ["غاز", "حريق", "حريقه", "اصابه", "مصاب", "انهيار", "انهار"]

_DIACRITICS = re.compile("[ً-ٰـ]")


def normalize_ar(s: str) -> str:
    """Strip diacritics/tatweel, unify alef/yaa/taa-marbuta, collapse whitespace."""
    s = _DIACRITICS.sub("", s.lower())
    s = re.sub("[أإآ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"\s+", " ", s).strip()


def _shift(severity: str, by: int) -> str:
    return SEVERITIES[min(len(SEVERITIES) - 1, max(0, SEVERITIES.index(severity) + by))]


def triage_text(
    description: str, categories: list[Category], departments: dict[str, str], category_id: str | None = None
) -> dict:
    """Top-3 categories (confidence sum <= 1), severity and a one-line Arabic summary."""
    text = normalize_ar(description or "")
    by_id = {c.id: c for c in categories}
    scores = []
    for c in categories:
        hits = len({k for k in map(normalize_ar, KEYWORDS.get(c.id, [])) if k in text})
        prior = 4 if category_id == c.id else 0
        scores.append((c.id, 0.2 + hits * 3 + prior))
    total = sum(s for _, s in scores)
    ranked = sorted(scores, key=lambda x: (-x[1], x[0]))[:3]
    options = [{"categoryId": cid, "confidence": math.floor((s / total) * 100) / 100} for cid, s in ranked]

    top = by_id[options[0]["categoryId"]]
    severity = top.default_severity
    up = any(normalize_ar(k) in text for k in ESCALATE)
    down = any(normalize_ar(k) in text for k in DE_ESCALATE)
    if up:
        severity = _shift(severity, 1)
    elif down and not top.danger:
        severity = _shift(severity, -1)
    if top.danger and SEVERITIES.index(severity) < SEVERITIES.index("high"):
        severity = "high"

    dept = departments.get(top.department_id, "")
    summary = f'الغالب إنها "{top.label_ar}" — {SEVERITY_LABEL_AR[severity]}، وهتروح لـ{dept}.'
    out = {"options": options, "severity": severity, "summary": summary, "source": "fallback"}
    if any(normalize_ar(k) in text for k in EMERGENCY):
        out["emergency"] = True
    return out
