import pytest
from app.config import Settings
from app.lark.client import LarkClient, LarkNotConfigured


def test_endpoint_matrix():
    assert "feishu.cn" in Settings(lark_variant="feishu").lark_api_base_url
    assert "larksuite.com" in Settings(lark_variant="lark").lark_api_base_url
    # Explicit override wins over variant.
    s = Settings(lark_variant="feishu", lark_api_base="https://example.test")
    assert s.lark_api_base_url == "https://example.test"


async def test_degrades_without_credentials():
    client = LarkClient()
    # Force "not configured" regardless of ambient .env so the test is hermetic.
    client._app_id = ""
    client._app_secret = ""
    assert client.configured is False
    with pytest.raises(LarkNotConfigured):
        await client.get_tenant_access_token()
