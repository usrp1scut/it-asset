from functools import lru_cache
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Lark / 飞书 endpoint matrix. Both variants must be supported (see DEVELOPMENT_PLAN §1.2).
_LARK_ENDPOINTS = {
    "feishu": {
        "api_base": "https://open.feishu.cn",
        "passport_base": "https://passport.feishu.cn",
    },
    "lark": {
        "api_base": "https://open.larksuite.com",
        "passport_base": "https://passport.larksuite.com",
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

    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 720

    lark_variant: Literal["feishu", "lark"] = "feishu"
    lark_app_id: str = ""
    lark_app_secret: str = ""
    # Optional chat/group id for stock-warning bot pushes. Empty -> skip push.
    lark_alert_chat_id: str = ""
    # Explicit overrides; empty -> derive from lark_variant.
    lark_api_base: str = ""
    lark_passport_base: str = ""

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
