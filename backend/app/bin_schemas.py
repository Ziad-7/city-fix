"""Request and response schemas for smart-bin telemetry."""

from datetime import datetime
from typing import Literal

from pydantic import ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

from app.admin_schemas import CamelCaseModel


class BinReadingInput(CamelCaseModel):
    model_config = ConfigDict(
        alias_generator=lambda value: "".join(
            word.capitalize() if index else word
            for index, word in enumerate(value.split("_"))
        ),
        populate_by_name=True,
        extra="forbid",
    )

    seq: int = Field(ge=1, le=9_007_199_254_740_991)
    at: datetime | None
    fill_pct: float = Field(ge=0, le=100, allow_inf_nan=False)
    distance_cm: float | None = Field(default=None, ge=0, le=200, allow_inf_nan=False)
    temp_c: float = Field(ge=-40, le=125, allow_inf_nan=False)
    battery_v: float = Field(ge=0, le=6, allow_inf_nan=False)
    rssi: int | None = Field(default=None, ge=-127, le=0)
    fw: Annotated[str, StringConstraints(min_length=1, max_length=40)] | None = None


class BinReadingsBatch(CamelCaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    readings: list[BinReadingInput] = Field(min_length=1, max_length=50)


class CreateBinInput(CamelCaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
    name: Annotated[str, StringConstraints(min_length=1, max_length=255)]
    district: Annotated[str, StringConstraints(min_length=1, max_length=100)] = (
        "القاهرة"
    )
    department_id: str | None = None
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    is_simulated: bool = False
    full_pct: float = Field(default=80, ge=0, le=100, allow_inf_nan=False)
    heat_c: float = Field(default=60, ge=-40, le=125, allow_inf_nan=False)
    interval_min: int = Field(default=30, ge=1, le=1440)


class BinReadingResponse(CamelCaseModel):
    id: int
    bin_id: str
    seq: int
    recorded_at: datetime
    received_at: datetime
    fill_pct: float
    distance_cm: float | None
    temp_c: float
    battery_v: float
    rssi: int | None
    firmware: str | None
    is_full: bool
    is_hot: bool


class BinResponse(CamelCaseModel):
    id: str
    name: str
    district: str
    department_id: str | None
    lat: float
    lng: float
    is_active: bool
    is_simulated: bool
    full_pct: float
    heat_c: float
    interval_min: int
    last_seq: int
    fill_pct: float | None
    temp_c: float | None
    battery_v: float | None
    is_full: bool
    is_hot: bool
    last_seen_at: datetime | None
    status: Literal["offline", "full", "heat", "low_battery", "normal"]
