"""Tests for duplicate detection using haversine distance."""
import pytest
from app.logic.duplicates import haversine_m, is_within_radius


class TestHaversineDistance:
    """Tests for haversine distance calculation."""

    def test_same_location_is_zero(self):
        """Distance between same point should be ~0."""
        d = haversine_m(30.056, 31.33, 30.056, 31.33)
        assert d < 1  # Less than 1 meter

    def test_known_distances(self):
        """Test known approximate distances."""
        # Nasr City center (30.056, 31.33) to a point ~250m north
        # Expected distance is approximately 250 meters
        d = haversine_m(30.056, 31.33, 30.058, 31.33)
        # At this latitude, ~0.002 degrees is roughly ~220 meters
        assert 200 < d < 300

    def test_distance_is_symmetric(self):
        """Distance from A to B should equal distance from B to A."""
        d1 = haversine_m(30.0, 31.0, 30.1, 31.1)
        d2 = haversine_m(30.1, 31.1, 30.0, 31.0)
        assert d1 == d2


class TestIsWithinRadius:
    """Tests for within-radius check."""

    def test_same_location_within_radius(self):
        """Same location should be within any radius."""
        assert is_within_radius(30.056, 31.33, 30.056, 31.33, 250)

    def test_distant_point_outside_radius(self):
        """A point ~1km away should be outside 250m radius."""
        # Approximate: 0.01 degrees is roughly 1km at this latitude
        assert not is_within_radius(30.056, 31.33, 30.066, 31.33, 250)

    def test_nearby_point_within_radius(self):
        """A point ~250m away should be within 250m radius."""
        assert is_within_radius(30.056, 31.33, 30.058, 31.33, 250)

    def test_threshold_boundary(self):
        """Test near the 250m boundary."""
        # Roughly 250m away at this latitude (0.002 degrees)
        result = is_within_radius(30.056, 31.33, 30.058, 31.33, 250)
        # Should be within (or very close)
        assert result is True

    def test_default_radius(self):
        """Default radius should be 250m."""
        # These two points are about 222 meters apart
        assert is_within_radius(30.056, 31.33, 30.058, 31.33)
