"""Private Supabase Storage adapter for citizen media."""

from pathlib import PurePosixPath
from uuid import uuid4

import httpx
from fastapi import HTTPException

MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_VOICE_BYTES = 15 * 1024 * 1024
MEDIA_TYPES = {
    "report_photo": {"image/jpeg", "image/png", "image/webp"},
    "voice_note": {
        "audio/mp4",
        "audio/mpeg",
        "audio/webm",
        "audio/ogg",
    },
}
EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
}


class SupabaseMediaStorage:
    """Use a private bucket and a server-only service key; never expose that key."""

    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        bucket: str = "report-media",
        *,
        transport: httpx.BaseTransport | None = None,
        timeout_seconds: float = 5.0,
    ) -> None:
        self._base_url = supabase_url.rstrip("/")
        if not self._base_url.startswith("https://"):
            raise ValueError("Supabase Storage must use HTTPS")
        self._bucket = bucket
        self._client = httpx.Client(
            base_url=f"{self._base_url}/storage/v1",
            headers={
                "apikey": service_role_key,
                "authorization": f"Bearer {service_role_key}",
            },
            timeout=timeout_seconds,
            transport=transport,
        )
        self._async_client = httpx.AsyncClient(
            base_url=f"{self._base_url}/storage/v1",
            headers={
                "apikey": service_role_key,
                "authorization": f"Bearer {service_role_key}",
            },
            timeout=timeout_seconds,
            transport=transport,
        )
        self._private_bucket_verified = False
        self._async_private_bucket_verified = False

    def _ensure_private_bucket(self) -> None:
        if self._private_bucket_verified:
            return
        try:
            response = self._client.get(f"/bucket/{self._quoted_bucket}")
            response.raise_for_status()
            bucket_config = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise HTTPException(503, "مخزن الصور الخاص مش متاح أو غير مُعدّ.") from error
        if (
            not isinstance(bucket_config, dict)
            or bucket_config.get("public") is not False
        ):
            raise HTTPException(503, "لازم يكون مخزن الصور خاص.")
        self._private_bucket_verified = True

    def sign_upload(
        self, user_id: str, kind: str, content_type: str
    ) -> tuple[str, str]:
        self._validate_kind_type(kind, content_type)
        self._validate_user_id(user_id)
        self._ensure_private_bucket()
        path = f"{user_id}/{uuid4().hex}{EXTENSIONS[content_type]}"
        endpoint = (
            f"/object/upload/sign/{self._quoted_bucket}/{self._quoted_path(path)}"
        )
        try:
            response = self._client.post(
                endpoint,
                headers={"x-upsert": "false"},
            )
            response.raise_for_status()
            signed = self._signed_url_from(response.json())
        except (httpx.HTTPError, ValueError, AttributeError) as error:
            raise HTTPException(503, "خدمة رفع الصور مش متاحة دلوقتي.") from error
        if not isinstance(signed, str) or not signed:
            raise HTTPException(503, "تعذر تجهيز رابط رفع آمن.")
        return self._resolve_signed_url(signed), path

    def require_uploaded(self, user_id: str, path: str, kind: str) -> None:
        self._validate_owned_path(user_id, path)
        if kind not in MEDIA_TYPES:
            raise HTTPException(400, "نوع الملف غير مدعوم.")
        self._ensure_private_bucket()
        endpoint = f"/object/{self._quoted_bucket}/{self._quoted_path(path)}"
        try:
            response = self._client.head(endpoint)
        except httpx.HTTPError as error:
            raise HTTPException(503, "تعذر التحقق من الملف المرفوع.") from error
        if response.status_code == 404:
            raise HTTPException(404, "الملف المرفوع مش موجود.")
        if response.status_code in (401, 403):
            raise HTTPException(403, "الملف مش تابع لحسابك.")
        if response.is_error:
            raise HTTPException(503, "تعذر التحقق من الملف المرفوع.")
        content_type = response.headers.get("content-type", "").split(";")[0].lower()
        if content_type not in MEDIA_TYPES[kind]:
            raise HTTPException(415, "نوع الملف المرفوع غير مطابق.")
        try:
            size = int(response.headers.get("content-length", "-1"))
        except ValueError as error:
            raise HTTPException(400, "حجم الملف غير صالح.") from error
        limit = MAX_PHOTO_BYTES if kind == "report_photo" else MAX_VOICE_BYTES
        if size < 0 or size > limit:
            raise HTTPException(413, "حجم الملف أكبر من المسموح.")

    def sign_read(self, user_id: str, path: str) -> str:
        self._validate_owned_path(user_id, path)
        self._ensure_private_bucket()
        endpoint = f"/object/sign/{self._quoted_bucket}/{self._quoted_path(path)}"
        try:
            response = self._client.post(endpoint, json={"expiresIn": 900})
            response.raise_for_status()
            signed = self._signed_url_from(response.json())
        except (httpx.HTTPError, ValueError, AttributeError) as error:
            raise HTTPException(503, "تعذر تجهيز رابط عرض مؤقت.") from error
        if not isinstance(signed, str) or not signed:
            raise HTTPException(503, "تعذر تجهيز رابط عرض مؤقت.")
        return self._resolve_signed_url(signed)

    def _resolve_signed_url(self, signed: str) -> str:
        if signed.startswith("https://"):
            resolved = httpx.URL(signed)
            base = httpx.URL(self._base_url)
            if (
                resolved.host != base.host
                or resolved.port != base.port
                or resolved.scheme != "https"
            ):
                raise HTTPException(502, "رابط التخزين غير صالح.")
            return str(resolved)
        suffix = signed if signed.startswith("/") else "/" + signed
        if suffix.startswith("/storage/v1/"):
            return self._base_url + suffix
        return self._base_url + "/storage/v1" + suffix

    @staticmethod
    def _signed_url_from(payload: object) -> str | None:
        if not isinstance(payload, dict):
            return None
        value = payload.get("signedURL", payload.get("signedUrl", payload.get("url")))
        return value if isinstance(value, str) else None

    async def read_approved(
        self, user_id: str, path: str, kind: str, consent: bool = False
    ) -> bytes:
        """Require explicit AI consent and return an owned source photo for local redaction."""
        if kind != "report_photo":
            raise HTTPException(400, "تحليل الصور متاح لصور البلاغات فقط.")
        if not consent:
            raise HTTPException(403, "لازم توافق على تحليل الصورة بالذكاء الاصطناعي.")
        self._validate_owned_path(user_id, path)
        await self._ensure_private_bucket_async()
        endpoint = f"/object/{self._quoted_bucket}/{self._quoted_path(path)}"
        try:
            metadata = await self._async_client.head(endpoint)
        except httpx.HTTPError as error:
            raise HTTPException(503, "تعذر التحقق من الصورة.") from error
        self._validate_upload_response(metadata, "report_photo")
        try:
            response = await self._async_client.get(endpoint)
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise HTTPException(404, "الصورة مش متاحة.") from error
        if len(response.content) > MAX_PHOTO_BYTES:
            raise HTTPException(413, "حجم الصورة أكبر من المسموح.")
        content_type = response.headers.get("content-type", "").split(";")[0]
        if content_type.lower() not in MEDIA_TYPES["report_photo"]:
            raise HTTPException(415, "نوع الصورة المرفوعة غير مطابق.")
        return response.content

    async def _ensure_private_bucket_async(self) -> None:
        if self._async_private_bucket_verified:
            return
        try:
            response = await self._async_client.get(f"/bucket/{self._quoted_bucket}")
            response.raise_for_status()
            bucket_config = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise HTTPException(503, "مخزن الصور الخاص مش متاح أو غير مُعدّ.") from error
        if (
            not isinstance(bucket_config, dict)
            or bucket_config.get("public") is not False
        ):
            raise HTTPException(503, "لازم يكون مخزن الصور خاص.")
        self._async_private_bucket_verified = True

    def close(self) -> None:
        self._client.close()

    async def aclose(self) -> None:
        await self._async_client.aclose()

    @staticmethod
    def _validate_upload_response(response: httpx.Response, kind: str) -> None:
        if response.status_code == 404:
            raise HTTPException(404, "الملف المرفوع مش موجود.")
        if response.status_code in (401, 403):
            raise HTTPException(403, "الملف مش تابع لحسابك.")
        if response.is_error:
            raise HTTPException(503, "تعذر التحقق من الملف المرفوع.")
        content_type = response.headers.get("content-type", "").split(";")[0].lower()
        if content_type not in MEDIA_TYPES[kind]:
            raise HTTPException(415, "نوع الملف المرفوع غير مطابق.")
        try:
            size = int(response.headers.get("content-length", "-1"))
        except ValueError as error:
            raise HTTPException(400, "حجم الملف غير صالح.") from error
        limit = MAX_PHOTO_BYTES if kind == "report_photo" else MAX_VOICE_BYTES
        if size < 0 or size > limit:
            raise HTTPException(413, "حجم الملف أكبر من المسموح.")

    @property
    def _quoted_bucket(self) -> str:
        return httpx.URL("/" + self._bucket).raw_path.decode().lstrip("/")

    @staticmethod
    def _quoted_path(path: str) -> str:
        return "/".join(
            httpx.URL("/" + segment).raw_path.decode().lstrip("/")
            for segment in path.split("/")
        )

    @staticmethod
    def _validate_user_id(user_id: str) -> None:
        if (
            not user_id
            or any(char in user_id for char in "/\\%")
            or user_id in {".", ".."}
        ):
            raise HTTPException(400, "معرّف الحساب غير صالح.")

    @classmethod
    def _validate_owned_path(cls, user_id: str, path: str) -> None:
        cls._validate_user_id(user_id)
        segments = path.split("/")
        parsed = PurePosixPath(path)
        if (
            parsed.is_absolute()
            or len(segments) != 2
            or any(not segment for segment in segments)
            or len(parsed.parts) != 2
            or parsed.parts[0] != user_id
            or any(part in {"", ".", ".."} for part in parsed.parts)
            or "\\" in path
            or "%" in path
            or "\x00" in path
        ):
            raise HTTPException(403, "الملف مش تابع لحسابك.")

    @staticmethod
    def _validate_kind_type(kind: str, content_type: str) -> None:
        if kind not in MEDIA_TYPES or content_type not in MEDIA_TYPES[kind]:
            raise HTTPException(415, "نوع الملف غير مدعوم للاستخدام ده.")
