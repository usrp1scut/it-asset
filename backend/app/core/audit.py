"""Generic audit trail.

Asset state/owner changes are recorded semantically as AssetChangeLog inside the
service layer (richer than a raw column diff). This module adds a coarse
API-level audit_logs entry for mutating endpoints — together they satisfy the
PRD requirement that every state/inventory change is logged.
"""

from sqlalchemy.orm import Session

from app.modules.assets.models import AuditLog


def write_audit(
    db: Session,
    *,
    actor_user_id: int | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    payload: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            payload=payload,
        )
    )
    db.commit()
