"""Tests for priority calculation logic."""

from app.logic.priority import (
    compute_priority,
    priority_level,
    MAX,
)


base = {
    "severity": "medium",
    "near_sensitive_place": False,
    "reporters": 1,
    "days_open": 0,
    "target_days": 5,
    "area_underserved": False,
}


class TestComputePriority:
    """Tests for compute_priority function."""

    def test_deterministic_and_sums_factors(self):
        """Priority computation should be deterministic and sum factors."""
        a = compute_priority(base)
        b = compute_priority(base)
        assert a == b
        assert a["score"] == sum(f["points"] for f in a["factors"])
        assert [f["key"] for f in a["factors"]] == [
            "severity",
            "sensitive",
            "reporters",
            "age",
            "equity",
        ]
        for f in a["factors"]:
            assert len(f["label"]) > 0

    def test_scores_higher_for_severity_sensitive_reporters_age_equity(self):
        """Score should increase for higher severity, sensitive place, more reporters, older age, underserved."""
        s0 = compute_priority(base)["score"]
        assert compute_priority({**base, "severity": "critical"})["score"] > s0
        assert (
            compute_priority({**base, "near_sensitive_place": True})["score"]
            == s0 + MAX["sensitive"]
        )
        assert compute_priority({**base, "reporters": 7})["score"] == s0 + (7 - 1) * 3
        assert compute_priority({**base, "days_open": 5})["score"] == s0 + 10
        assert (
            compute_priority({**base, "area_underserved": True})["score"]
            == s0 + MAX["equity"]
        )

    def test_caps_factors_and_total(self):
        """Each factor and total should be capped."""
        maxed = compute_priority(
            {
                "severity": "critical",
                "near_sensitive_place": True,
                "reporters": 99,
                "days_open": 99,
                "target_days": 1,
                "area_underserved": True,
            }
        )
        assert maxed["score"] <= 100
        assert all(f["points"] <= f["max"] for f in maxed["factors"])

    def test_age_points_specific_values(self):
        """Age factor should return specific points for given daysOpen/targetDays."""
        # daysOpen 1, targetDays 4 → age points 3
        result1 = compute_priority(
            {
                "severity": "medium",
                "near_sensitive_place": False,
                "reporters": 1,
                "days_open": 1,
                "target_days": 4,
                "area_underserved": False,
            }
        )
        age_factor1 = next((f for f in result1["factors"] if f["key"] == "age"), None)
        assert age_factor1 is not None, "Age factor not found"
        assert age_factor1["points"] == 3, (
            f"Expected 3 age points for days_open=1, target_days=4, got {age_factor1['points']}"
        )

        # daysOpen 9, targetDays 20 → age points 5
        result2 = compute_priority(
            {
                "severity": "medium",
                "near_sensitive_place": False,
                "reporters": 1,
                "days_open": 9,
                "target_days": 20,
                "area_underserved": False,
            }
        )
        age_factor2 = next((f for f in result2["factors"] if f["key"] == "age"), None)
        assert age_factor2 is not None, "Age factor not found"
        assert age_factor2["points"] == 5, (
            f"Expected 5 age points for days_open=9, target_days=20, got {age_factor2['points']}"
        )

    def test_priority_level_mapping(self):
        """Score should map correctly to priority level."""
        assert priority_level(90) == "critical"
        assert priority_level(70) == "high"
        assert priority_level(45) == "medium"
        assert priority_level(10) == "low"


class TestPriorityLevel:
    """Tests for priority_level function."""

    def test_critical_threshold(self):
        """Score >= 85 should be critical."""
        assert priority_level(85) == "critical"
        assert priority_level(86) == "critical"
        assert priority_level(100) == "critical"

    def test_high_threshold(self):
        """Score >= 65 and < 85 should be high."""
        assert priority_level(65) == "high"
        assert priority_level(84) == "high"

    def test_medium_threshold(self):
        """Score >= 40 and < 65 should be medium."""
        assert priority_level(40) == "medium"
        assert priority_level(64) == "medium"

    def test_low_threshold(self):
        """Score < 40 should be low."""
        assert priority_level(0) == "low"
        assert priority_level(39) == "low"
