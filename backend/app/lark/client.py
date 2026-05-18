"""Lark / 飞书 API client.

Endpoint-agnostic by design: the same code targets 国内飞书 (open.feishu.cn) or
海外 Lark (open.larksuite.com) purely via settings (DEVELOPMENT_PLAN §1.2). All Lark
calls in the app must go through this layer — never hardcode domains in business code.

tenant_access_token is cached in Redis and refreshed 5 min before its ~2h expiry
(DEVELOPMENT_PLAN §7.1). When app credentials are absent the client degrades
gracefully: callers get LarkNotConfigured and can fall back to mock data so the
rest of the system stays runnable before the customer supplies app_id/secret.
"""

import httpx

from app.cache import get_redis
from app.config import get_settings

_TENANT_TOKEN_KEY = "lark:tenant_access_token"
_APP_TOKEN_KEY = "lark:app_access_token"
_REFRESH_SKEW_SECONDS = 300  # refresh this long before real expiry


class LarkNotConfigured(RuntimeError):
    """Raised when LARK_APP_ID / LARK_APP_SECRET are not set."""


class LarkClient:
    def __init__(self) -> None:
        s = get_settings()
        self._api_base = s.lark_api_base_url
        self._app_id = s.lark_app_id
        self._app_secret = s.lark_app_secret

    @property
    def api_base(self) -> str:
        return self._api_base

    @property
    def configured(self) -> bool:
        return bool(self._app_id and self._app_secret)

    def _url(self, path: str) -> str:
        return f"{self._api_base}/{path.lstrip('/')}"

    async def _fetch_internal_token(self, path: str, token_field: str, cache_key: str) -> str:
        if not self.configured:
            raise LarkNotConfigured("LARK_APP_ID / LARK_APP_SECRET not configured")
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                self._url(path),
                json={"app_id": self._app_id, "app_secret": self._app_secret},
            )
            resp.raise_for_status()
            data = resp.json()
        token: str = data[token_field]
        expire: int = int(data.get("expire", 7200))
        get_redis().set(cache_key, token, ex=max(expire - _REFRESH_SKEW_SECONDS, 60))
        return token

    async def get_tenant_access_token(self, *, force: bool = False) -> str:
        """Valid tenant_access_token, Redis-cached, refreshed 5 min before expiry."""
        if not force and (cached := get_redis().get(_TENANT_TOKEN_KEY)):
            return cached
        return await self._fetch_internal_token(
            "/open-apis/auth/v3/tenant_access_token/internal",
            "tenant_access_token",
            _TENANT_TOKEN_KEY,
        )

    async def get_app_access_token(self, *, force: bool = False) -> str:
        """app_access_token — required by the authen/v1 login-code exchange."""
        if not force and (cached := get_redis().get(_APP_TOKEN_KEY)):
            return cached
        return await self._fetch_internal_token(
            "/open-apis/auth/v3/app_access_token/internal",
            "app_access_token",
            _APP_TOKEN_KEY,
        )

    async def get_paginated(self, path: str, params: dict) -> list[dict]:
        """GET a Lark list endpoint, following page_token until has_more is false."""
        token = await self.get_tenant_access_token()
        out: list[dict] = []
        page_token: str | None = None
        async with httpx.AsyncClient(timeout=15) as client:
            while True:
                q = dict(params)
                if page_token:
                    q["page_token"] = page_token
                resp = await client.get(
                    self._url(path),
                    headers={"Authorization": f"Bearer {token}"},
                    params=q,
                )
                resp.raise_for_status()
                data = resp.json().get("data", {})
                out.extend(data.get("items", []))
                if not data.get("has_more"):
                    break
                page_token = data.get("page_token")
        return out

    async def exchange_login_code(self, code: str) -> dict:
        """Exchange a frontend login `code` for the user's Lark profile.

        Returns the raw `data` object (open_id / union_id / name / email / ...).
        """
        app_token = await self.get_app_access_token()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                self._url("/open-apis/authen/v1/access_token"),
                headers={"Authorization": f"Bearer {app_token}"},
                json={"grant_type": "authorization_code", "code": code},
            )
            resp.raise_for_status()
            body = resp.json()
        if body.get("code") != 0:
            raise RuntimeError(f"Lark login exchange failed: {body.get('msg')}")
        return body["data"]


def get_lark_client() -> LarkClient:
    return LarkClient()
