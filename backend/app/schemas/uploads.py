from typing import Literal, Self

from pydantic import HttpUrl, model_validator

from app.schemas.auth import ApiModel
from app.schemas.citizen import InputModel


class UploadRequest(InputModel):
    kind: Literal["report_photo", "voice_note"]
    content_type: Literal[
        "image/jpeg",
        "image/png",
        "image/webp",
        "audio/mp4",
        "audio/mpeg",
        "audio/webm",
        "audio/ogg",
    ]

    @model_validator(mode="after")
    def matching_kind(self) -> Self:
        prefix = "image/" if self.kind == "report_photo" else "audio/"
        if not self.content_type.startswith(prefix):
            raise ValueError("نوع الملف مش مطابق للاستخدام")
        return self


class UploadResponse(ApiModel):
    upload_url: HttpUrl
    path: str
