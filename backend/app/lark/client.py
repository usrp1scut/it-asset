"""Lark / 飞书 API client.

Endpoint-agnostic by design: the same code targets 国内飞书 (open.feishu.cn) or
海外 Lark (open.larksuite.com) purely via settings (DEVELOPMENT_PLAN §1.2). All Lark
calls in the app must go through this layer — never hardcode domains in business code.

Sprint 0: connectivity skeleton only. tenant_access_token caching (Redis, refresh
5 min early), contact sync, messaging and webhooks land in Sprint 1+.
"""

import httpx

from app.config import get_settings


class LarkClient:
    def __init__(self) -> None:
        s = get_settings()
        self._api_base = s.lark_api_base_url
        self._app_id = s.lark_app_id
        self._app_secret = s.lark_app_secret

    @property
    def api_base(self) -> str:
        return self._api_base

    def _url(self, path: str) -> str:
        return f"{self._api_base}/{path.lstrip('/')}"

    async def fetch_tenant_access_token(self) -> str:
        """Exchange app credentials for a tenant_access_token.

        TODO(Sprint 1): cache in Redis, refresh 5 min before the 2h expiry.
        """
        if not self._app_id or not self._app_secret:
            raise RuntimeError("LARK_APP_ID / LARK_APP_SECRET not configured")
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                self._url("/open-apis/auth/v3/tenant_access_token/internal"),
                json={"app_id": self._app_id, "app_secret": self._app_secret},
            )
            resp.raise_for_status()
            return resp.json()["tenant_access_token"]


def get_lark_client() -> LarkClient:
    return LarkClient()
