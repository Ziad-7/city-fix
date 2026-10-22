from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class OtpRequest(ApiModel):
    phone: str = Field(pattern=r"^01[0125][0-9]{8}$")
    channel: Literal["sms", "whatsapp"]


class VerifyRequest(ApiModel):
    phone: str = Field(pattern=r"^01[0125][0-9]{8}$")
    code: str = Field(pattern=r"^[0-9]{6}$")


class SessionResponse(ApiModel):
    user_id: str
    phone: str
    name: str | None = None
    token: str
