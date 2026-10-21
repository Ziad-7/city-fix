"""Duplicate detection using haversine distance."""
import math


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate great-circle distance between two points in metres.
    Uses the haversine formula.
    """
    R = 6_371_000  # Earth radius in meters

    def rad(d: float) -> float:
        return (d * math.pi) / 180

    d_lat = rad(lat2 - lat1)
    d_lng = rad(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def is_within_radius(
    lat1: float, lng1: float, lat2: float, lng2: float, radius_m: float = 250
) -> bool:
    """Check if two points are within radius_m metres of each other."""
    return haversine_m(lat1, lng1, lat2, lng2) <= radius_m
