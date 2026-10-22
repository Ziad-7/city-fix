"""The fallback triage summary must show the Arabic severity label, never the raw enum token."""

import pytest

from app.ai.keywords import classify_keywords
from app.ai.schemas import CategoryId, Severity
from app.logic.timeline import SEVERITY_LABEL_AR


@pytest.mark.parametrize(
    ("description", "category", "expected"),
    [
        ("زبالة قدام البيت", CategoryId.garbage, Severity.low),
        ("حفرة في الشارع", CategoryId.pothole, Severity.medium),
        ("غطا بلاعة مفتوح", CategoryId.open_manhole, Severity.high),
        ("سلك كهرباء عريان وحد اتكهرب", CategoryId.exposed_wire, Severity.critical),
    ],
)
def test_summary_uses_arabic_severity_label(description, category, expected):
    result = classify_keywords(description, category)
    assert result.severity in set(Severity)
    for token in ("low", "medium", "high", "critical"):
        assert token not in result.summary
    assert SEVERITY_LABEL_AR[result.severity.value] in result.summary


def test_every_severity_label_is_arabic_and_distinct():
    labels = {SEVERITY_LABEL_AR[s.value] for s in Severity}
    assert len(labels) == 4
