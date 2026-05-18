from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "it_asset",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    task_track_started=True,
    timezone="Asia/Shanghai",
    beat_schedule={
        "sync-contacts-daily": {
            "task": "users.sync_contacts",
            # Every day at 02:30 (low-traffic window).
            "schedule": 24 * 60 * 60,
        },
    },
)

# Import task modules so Celery registers them.
import app.modules.users.tasks  # noqa: E402,F401
