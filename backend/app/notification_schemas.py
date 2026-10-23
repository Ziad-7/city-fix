"""Frozen notification and push-token HTTP shapes."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


class NotificationData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    incident_id: str | None = Field(default=None, alias="incidentId")
    pickup_id: str | None = Field(default=None, alias="pickupId")


class NotificationItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    kind: Literal["incident_status", "pickup_status"]
    title: str
    body: str
    data: dict[str, str]
    created_at: datetime = Field(alias="createdAt")
    read_at: datetime | None = Field(alias="readAt")

    @field_serializer("created_at", "read_at")
    def _utc_rfc3339(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        return aware.isoformat().replace("+00:00", "Z")


class NotificationList(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[NotificationItem]
    next_before_id: str | None = Field(alias="nextBeforeId")


class ReadNotificationInput(BaseModel):
    read: Literal[True]


class PushTokenInput(BaseModel):
    token: str = Field(min_length=1, max_length=256)
    platform: Literal["ios", "android"]

    @field_validator("token")
    @classmethod
    def _valid_expo_token(cls, value: str) -> str:
        import re

        if not re.fullmatch(r"Expo(?:nent)?PushToken\[[A-Za-z0-9_+\-/=]+\]", value):
            raise ValueError("Invalid Expo push token")
        return value


class DeletePushTokenInput(BaseModel):
    token: str = Field(min_length=1, max_length=256)
