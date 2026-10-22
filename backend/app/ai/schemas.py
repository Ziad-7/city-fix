from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class CategoryId(StrEnum):
    pothole = "pothole"
    open_manhole = "open_manhole"
    sewage_overflow = "sewage_overflow"
    water_pipe_burst = "water_pipe_burst"
    garbage = "garbage"
    streetlight_out = "streetlight_out"
    exposed_wire = "exposed_wire"
    road_obstruction = "road_obstruction"
    stray_dogs = "stray_dogs"
    fallen_tree = "fallen_tree"
    broken_sidewalk = "broken_sidewalk"
    other = "other"


class Severity(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Location(ApiModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: str | None = Field(default=None, max_length=300)  # clients send the picked address too


class TriageRequest(ApiModel):
    description: str = Field(default="", max_length=2000)
    category_id: CategoryId | None = None
    photo_uri: str | None = Field(default=None, max_length=512)
    photo_consent: bool = False
    location: Location | None = None

    @field_validator("photo_uri")
    @classmethod
    def validate_storage_path(cls, value: str | None) -> str | None:
        if value is None:
            return None
        path = value.strip()
        if not path or path.startswith(("/", "\\")) or "://" in path or "\\" in path:
            raise ValueError("photoUri must be a relative storage path")
        segments = path.split("/")
        if any(part in {"", ".", ".."} for part in segments):
            raise ValueError("photoUri must be a normalized storage path")
        return path


class TriageOption(ApiModel):
    category_id: CategoryId
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)


class ModelSuggestion(ApiModel):
    options: list[TriageOption] = Field(min_length=3, max_length=3)
    severity: Severity
    summary: str = Field(min_length=1, max_length=180)

    @field_validator("summary")
    @classmethod
    def summary_is_one_line(cls, value: str) -> str:
        if "\n" in value or "\r" in value:
            raise ValueError("summary must be one line")
        return value

    @model_validator(mode="after")
    def valid_ranking(self):
        ids = [option.category_id for option in self.options]
        if len(set(ids)) != 3:
            raise ValueError("options must contain three distinct categories")
        if sum(option.confidence for option in self.options) > 1.000001:
            raise ValueError("option confidences must sum to at most 1")
        if [option.confidence for option in self.options] != sorted(
            (option.confidence for option in self.options), reverse=True
        ):
            raise ValueError("options must be ordered by descending confidence")
        return self


class DuplicateMatch(ApiModel):
    incident_id: str
    title: str
    category_id: CategoryId
    distance_m: float = Field(ge=0)
    followers: int = Field(ge=0)
    status: str


class AlreadyReported(ApiModel):
    incident_id: str
    report_id: str
    title: str
    category_id: CategoryId
    distance_m: float = Field(ge=0)


class TriageSuggestion(ModelSuggestion):
    duplicates: list[DuplicateMatch] = Field(default_factory=list)
    already_reported: list[AlreadyReported] | None = None
    source: Literal["model", "fallback"]
    emergency: bool = False


class ProviderError(RuntimeError):
    """The hosted model is unavailable or returned a response we cannot use."""
