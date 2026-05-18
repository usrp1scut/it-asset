from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_roles
from app.modules.assets.models import Asset, AssetClass, AssetStatus
from app.modules.inspections.models import (
    ConfirmStatus,
    InspectionItem,
    InspectionStatus,
    InspectionTask,
)
from app.modules.users.models import Role, User

router = APIRouter(prefix="/api/inspections", tags=["inspections"])
it_admin = require_roles(Role.it_admin)


class CreateIn(BaseModel):
    name: str


class ConfirmIn(BaseModel):
    status: ConfirmStatus
    remark: str | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(body: CreateIn, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    """Snapshot every personal in-use asset into a stocktake task."""
    task = InspectionTask(name=body.name, created_by=user.id)
    db.add(task)
    db.flush()
    assets = db.scalars(
        select(Asset).where(
            Asset.deleted_at.is_(None),
            Asset.asset_class == AssetClass.personal,
            Asset.status == AssetStatus.in_use,
        )
    ).all()
    for a in assets:
        db.add(
            InspectionItem(task_id=task.id, asset_id=a.id, expected_owner_id=a.owner_user_id)
        )
    db.commit()
    return {"id": task.id, "name": task.name, "item_count": len(assets)}


@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db), _: User = Depends(it_admin)):
    task = db.get(InspectionTask, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    items = db.execute(
        select(InspectionItem, Asset.asset_code)
        .join(Asset, Asset.id == InspectionItem.asset_id)
        .where(InspectionItem.task_id == task_id)
    ).all()
    by = dict(
        db.execute(
            select(InspectionItem.confirm_status, func.count())
            .where(InspectionItem.task_id == task_id)
            .group_by(InspectionItem.confirm_status)
        ).all()
    )
    return {
        "id": task.id,
        "name": task.name,
        "status": task.status.value,
        "progress": {s.value: int(by.get(s, 0)) for s in ConfirmStatus},
        "items": [
            {
                "asset_code": code,
                "confirm_status": it.confirm_status.value,
                "expected_owner_id": it.expected_owner_id,
                "remark": it.remark,
            }
            for it, code in items
        ],
    }


@router.post("/{task_id}/items/{asset_code}/confirm")
def confirm_item(
    task_id: int,
    asset_code: str,
    body: ConfirmIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Employee confirms an asset they hold (or flags a mismatch)."""
    asset = db.scalar(select(Asset).where(Asset.asset_code == asset_code))
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    item = db.scalar(
        select(InspectionItem).where(
            InspectionItem.task_id == task_id, InspectionItem.asset_id == asset.id
        )
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "inspection item not found")
    item.confirm_status = body.status
    item.confirmed_by = user.id
    item.confirmed_at = datetime.now(UTC)
    item.remark = body.remark
    db.commit()
    return {"asset_code": asset_code, "confirm_status": item.confirm_status.value}


@router.post("/{task_id}/close")
def close_task(task_id: int, db: Session = Depends(get_db), _: User = Depends(it_admin)):
    task = db.get(InspectionTask, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    task.status = InspectionStatus.closed
    task.ended_at = datetime.now(UTC)
    db.commit()
    return {"id": task.id, "status": task.status.value}
