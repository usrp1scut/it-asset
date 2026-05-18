import anyio

from app.db import SessionLocal
from app.modules.users.service import sync_directory
from app.worker import celery_app


@celery_app.task(name="users.sync_contacts")
def sync_contacts() -> dict:
    """Daily idempotent contact sync (Lark → DB). Safe to re-run."""
    db = SessionLocal()
    try:
        return anyio.run(sync_directory, db)
    finally:
        db.close()
