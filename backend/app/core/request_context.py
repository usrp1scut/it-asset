"""Per-request client metadata (IP / User-Agent) for the audit trail.

A ContextVar carries the current request's client IP and UA so `write_audit`
can stamp them without every call site threading a `Request` through. A pure
ASGI middleware (not BaseHTTPMiddleware) sets it in the request's own task, so
the value reliably propagates into sync route handlers (run in a threadpool
whose context is copied from here).
"""

from contextvars import ContextVar

_meta: ContextVar[dict[str, str | None] | None] = ContextVar("request_meta", default=None)


def set_request_meta(ip: str | None, ua: str | None) -> None:
    _meta.set({"ip": ip, "ua": ua})


def get_request_meta() -> dict[str, str | None]:
    return _meta.get() or {}


class RequestMetaMiddleware:
    """Capture client IP + UA into the ContextVar at the start of each request.

    Prefers proxy headers (prod runs behind nginx, which sets X-Real-IP /
    X-Forwarded-For) and falls back to the direct ASGI peer.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers") or []}
            fwd = headers.get("x-forwarded-for")
            ip = (
                (fwd.split(",")[0].strip() if fwd else None)
                or headers.get("x-real-ip")
                or (scope["client"][0] if scope.get("client") else None)
            )
            set_request_meta(ip, headers.get("user-agent"))
        await self.app(scope, receive, send)
