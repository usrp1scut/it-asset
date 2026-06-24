import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings, validate_prod_settings
from app.core.request_context import RequestMetaMiddleware
from app.db import SessionLocal, engine
from app.modules.approvals.router import router as approvals_router
from app.modules.assets.repair_router import router as repair_router
from app.modules.assets.router import router as assets_router
from app.modules.assets.scrap_router import router as scrap_router
from app.modules.assets.types_router import router as asset_types_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.inspections.router import router as inspections_router
from app.modules.inventory.router import router as inventory_router
from app.modules.lottery.router import router as lottery_router
from app.modules.lottery.service import ensure_prize_category
from app.modules.offboarding.router import router as offboarding_router
from app.modules.users.people_router import router as users_router
from app.modules.users.router import router as auth_router
from app.modules.users.service import ensure_initial_admin

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Refuse to boot prod with a placeholder JWT secret (forgeable tokens).
    validate_prod_settings(settings)
    if not settings.app_debug and not settings.lark_verification_token:
        logging.getLogger(__name__).warning(
            "LARK_VERIFICATION_TOKEN 为空 — /api/lark/webhook 将接受无签名请求"
        )
    # First-run admin bootstrap from env (idempotent) + ensure the 奖品 (prize)
    # category exists (re-created here if it was ever deleted).
    db = SessionLocal()
    try:
        ensure_initial_admin(db)
        ensure_prize_category(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="资产与耗材管理系统",
    version="0.1.0",
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.app_debug else [],
    allow_methods=["*"],
    allow_headers=["*"],
)
# Capture client IP / UA for the audit trail (must wrap the routes).
app.add_middleware(RequestMetaMiddleware)


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(assets_router)
app.include_router(asset_types_router)
app.include_router(scrap_router)
app.include_router(repair_router)
app.include_router(inventory_router)
app.include_router(dashboard_router)
app.include_router(inspections_router)
app.include_router(approvals_router)
app.include_router(offboarding_router)
app.include_router(lottery_router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    """Liveness — process is up."""
    return {"status": "ok", "env": settings.app_env}


@app.get("/health/ready", tags=["meta"])
def ready() -> dict:
    """Readiness — DB reachable."""
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok}
