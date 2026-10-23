"""Request and response models for deterministic analytics previews."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class BinForecastItem(BaseModel):
    binId: str
    currentFillPct: float | None
    predictedFillPct: float | None
    hoursToFull: float | None
    sampleCount: int
    method: Literal["linear", "insufficient_data"]
    reason: Literal["ok", "insufficient_data", "stale", "non_increasing"]


class BinForecastResponse(BaseModel):
    generatedAt: datetime
    horizonHours: int
    items: list[BinForecastItem]


class Depot(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)


class OptimizeRoutesInput(BaseModel):
    pickupIds: list[str] = Field(min_length=1, max_length=100)
    depot: Depot
    vehicleCount: int = Field(ge=1, le=10)
    capacityKg: float = Field(gt=0, le=10000, allow_inf_nan=False)

    @field_validator("pickupIds")
    @classmethod
    def unique_ids(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("pickupIds must be unique")
        return value


class RouteStop(BaseModel):
    pickupId: str
    lat: float
    lng: float


class OptimizedRoute(BaseModel):
    vehicleIndex: int
    pickupIds: list[str]
    loadKg: float
    distanceMeters: int
    stops: list[RouteStop]


class OptimizeRoutesResponse(BaseModel):
    algorithm: Literal["ortools"]
    distanceModel: Literal["haversine"]
    routes: list[OptimizedRoute]
    unassignedPickupIds: list[str]
    totalDistanceMeters: int


class HotspotCategoryCount(BaseModel):
    categoryId: str
    count: int


class HotspotItem(BaseModel):
    id: str
    lat: float
    lng: float
    count: int
    categoryCounts: list[HotspotCategoryCount]
    maxPriorityScore: int


class HotspotsResponse(BaseModel):
    generatedAt: datetime
    days: int
    radiusMeters: int
    minCount: int
    items: list[HotspotItem]
