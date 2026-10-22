import math
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.citizen import Bounds, Citizen, Repository
from app.schemas.citizen import CategoryId, MapPin, Status

router = APIRouter(prefix="/map", tags=["map"])


def parse_bounds(raw: str | None) -> Bounds | None:
    if raw is None:
        return None
    try:
        west, south, east, north = map(float, raw.split(","))
        if not all(math.isfinite(n) for n in (west, south, east, north)):
            raise ValueError
        if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
            raise ValueError
        return west, south, east, north
    except ValueError:
        raise HTTPException(422, "حدود الخريطة مش صحيحة.") from None


@router.get("/incidents", response_model=list[MapPin])
def pins(
    user: Citizen,
    repo: Repository,
    status: Status | None = None,
    category_id: Annotated[CategoryId | None, Query(alias="categoryId")] = None,
    bbox: str | None = None,
) -> list[MapPin]:
    return repo.map_pins(status, category_id, parse_bounds(bbox))
