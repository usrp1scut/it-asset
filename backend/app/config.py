from functools import lru_cache
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Lark / 飞书 endpoint matrix. Both variants must be supported (see DEVELOPMENT_PLAN §1.2).
_LARK_ENDPOINTS = {
    "feishu": {
        "api_base": "https://open.feishu.cn",
        "passport_base": "https://passport.feishu.cn",
        # Domestic Feishu uses the /goofy/lark/op/ build of the SDK.
        "jssdk": "https://lf1-cdn-tos.bytegoofy.com/goofy/lark/op/h5-js-sdk-1.5.36.js",
    },
    "lark": {
        "api_base": "https://open.larksuite.com",
        "passport_base": "https://passport.larksuite.com",
        # International Lark expects a DIFFERENT SDK build under
        # /goofy/ee/lark/h5jssdk/lark/js_sdk/ — confirmed by Lark's own
        # lark-samples repo (web_app_with_jssdk/python/templates/index.html).
        # Using the /goofy/lark/op/ Feishu build inside Lark international's
        # client causes h5sdk.config to always fail with errno 2601002
        # "signature is expired" even when timestamp/url/ticket are perfect.
        "jssdk": "https://lf1-cdn-tos.bytegoofy.com/goofy/ee/lark/h5jssdk/lark/js_sdk/h5-js-sdk-1.5.11.js",
    },
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_debug: bool = True

    database_url: str = "postgresql+psycopg://itasset:itasset@db:5432/itasset"
    redis_url: str = "redis://redis:6379/0"

    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "it-asset"
    # Required by AWS S3 / Aliyun OSS (empty = none, fine for MinIO).
    s3_region: str = ""
    # Managed clouds pre-provision the bucket and creds usually lack
    # CreateBucket — set false in production to skip the bucket_exists/
    # make_bucket round-trip entirely.
    s3_auto_create_bucket: bool = True

    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 720

    # First-run admin bootstrap. If both email + password are set and no user
    # with that email exists yet, create one as it_admin on startup. Idempotent.
    initial_admin_email: str = ""
    initial_admin_password: str = ""
    initial_admin_name: str = "管理员"

    # Public base URL of the deployed app, used to encode scannable QR codes.
    # Empty -> QR encodes only the asset_code (text); set -> QR becomes
    # "<base>/assets?code=<code>", which any phone camera resolves to a tap.
    public_base_url: str = ""

    lark_variant: Literal["feishu", "lark"] = "feishu"
    lark_app_id: str = ""
    lark_app_secret: str = ""
    # Optional chat/group id for stock-warning bot pushes. Empty -> skip push.
    lark_alert_chat_id: str = ""
    # Event Subscription security (from the Lark dev console). Empty -> dev mode:
    # webhook accepts unsigned payloads (never leave empty in production).
    lark_verification_token: str = ""
    lark_encrypt_key: str = ""
    # H5 JSSDK script URL (免登). Defaults below per variant; override per
    # tenant/region if Lark serves a different CDN.
    lark_jssdk_url: str = ""
    # Explicit overrides; empty -> derive from lark_variant.
    lark_api_base: str = ""
    lark_passport_base: str = ""

    @computed_field
    @property
    def lark_jssdk_url_resolved(self) -> str:
        if self.lark_jssdk_url:
            return self.lark_jssdk_url
        return _LARK_ENDPOINTS[self.lark_variant]["jssdk"]

    @computed_field
    @property
    def lark_api_base_url(self) -> str:
        return self.lark_api_base or _LARK_ENDPOINTS[self.lark_variant]["api_base"]

    @computed_field
    @property
    def lark_passport_base_url(self) -> str:
        return self.lark_passport_base or _LARK_ENDPOINTS[self.lark_variant]["passport_base"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
