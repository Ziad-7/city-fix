"""Request bodies for CityCycle (recycling pickups, collectors, price list)."""

from datetime import date
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, field_validator

from app.schemas import CamelModel, PlaceInput, SlotId

MaterialId = Literal["pet_plastic", "paper_cardboard", "metal_cans", "glass", "e_waste", "cooking_oil", "organics"]
MATERIAL_IDS: tuple[str, ...] = (
    "pet_plastic",
    "paper_cardboard",
    "metal_cans",
    "glass",
    "e_waste",
    "cooking_oil",
    "organics",
)
PickupMode = Literal["free", "paid"]
WeighingSource = Literal["manual", "scale_ble", "scale_api"]
CollectorStatus = Literal["pending", "verified", "suspended"]


class PickupItemInput(CamelModel):
    material_id: MaterialId
    estimated_kg: float = Field(gt=0, le=1000, allow_inf_nan=False)


class NewRecyclingPickupInput(CamelModel):
    items: list[PickupItemInput] = Field(min_length=1, max_length=20)
    photo_uris: list[str] = Field(default=[], max_length=5)
    location: PlaceInput
    day: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    slot: SlotId
    mode: PickupMode
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("day")
    @classmethod
    def real_calendar_day(cls, value: str) -> str:
        date.fromisoformat(value)
        return value


class CancelPickupInput(CamelModel):
    note: str | None = Field(default=None, max_length=1000)


class CollectorApplyInput(CamelModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    district: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    materials: list[MaterialId] = Field(min_length=1, max_length=7)
    vehicle: str | None = Field(default=None, max_length=100)


class WeighingInput(CamelModel):
    material_id: MaterialId
    kg: float = Field(ge=0.5, le=500, allow_inf_nan=False)
    source: WeighingSource
    scale_id: str | None = Field(default=None, max_length=100)
    client_id: Annotated[str, StringConstraints(min_length=1, max_length=100)]


class CompleteInput(CamelModel):
    paid_to_household_egp: float | None = Field(default=None, ge=0, le=100000, allow_inf_nan=False)


class CollectorPatchInput(CamelModel):
    status: CollectorStatus
    note: str | None = Field(default=None, max_length=1000)


class PriceEntryInput(CamelModel):
    material_id: MaterialId
    price_egp_per_kg: float | None = Field(default=None, ge=0, le=100000, allow_inf_nan=False)


class PricesPutInput(CamelModel):
    district: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    prices: list[PriceEntryInput] = Field(min_length=1, max_length=7)


class ReportFullInput(CamelModel):
    note: str | None = Field(default=None, max_length=1000)
    photo_uri: str | None = None


class HubWeighingInput(CamelModel):
    seq: int = Field(ge=1, le=9_007_199_254_740_991)
    at: str | None = None
    material: MaterialId
    kg: float = Field(gt=0, le=5000, allow_inf_nan=False)
    pickup_id: str | None = None


class BinPatchInput(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None
    full_pct: float | None = Field(default=None, ge=0, le=100)
    heat_c: float | None = Field(default=None, ge=-40, le=125)
    interval_min: int | None = Field(default=None, ge=1, le=1440)
    rotate_key: bool = False


class WasteClassifyInput(CamelModel):
    path: Annotated[str, StringConstraints(min_length=1, max_length=500)]
    photo_consent: bool = False
    description: str | None = Field(default=None, max_length=500)


class PickupAdminPatchInput(CamelModel):
    status: Literal["requested", "accepted", "weighed", "completed", "cancelled"] | None = None
    collector_id: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=1000)
