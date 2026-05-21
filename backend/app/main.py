from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.db import SessionLocal, engine
from app.modules.approvals.router import router as approvals_router
from app.modules.assets.router import router as assets_router
from app.modules.assets.scrap_router import router as scrap_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.inspections.router import router as inspections_router
from app.modules.inventory.router import router as inventory_router
from app.modules.users.people_router import router as users_router
from app.modules.users.router import router as auth_router
from app.modules.users.service import ensure_initial_admin

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # First-run admin bootstrap from env (idempotent).
    db = SessionLocal()
    try:
        ensure_initial_admin(db)
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


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(assets_router)
app.include_router(scrap_router)
app.include_router(inventory_router)
app.include_router(dashboard_router)
app.include_router(inspections_router)
app.include_router(approvals_router)


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
