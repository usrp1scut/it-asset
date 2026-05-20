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


_SCOPES = {
    "personal_in_use", "personal_all", "infrastructure", "by_location", "by_department",
}


class CreateIn(BaseModel):
    name: str
    scope_type: str = "personal_in_use"
    location: str | None = None
    department_id: int | None = None


class ConfirmIn(BaseModel):
    status: ConfirmStatus
    remark: str | None = None


def _scope_query(body: CreateIn):
    if body.scope_type not in _SCOPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"未知 scope_type: {body.scope_type}"
        )
    stmt = select(Asset).where(Asset.deleted_at.is_(None))
    if body.scope_type == "personal_in_use":
        stmt = stmt.where(
            Asset.asset_class == AssetClass.personal,
            Asset.status == AssetStatus.in_use,
        )
    elif body.scope_type == "personal_all":
        stmt = stmt.where(
            Asset.asset_class == AssetClass.personal,
            Asset.status != AssetStatus.scrapped,
        )
    elif body.scope_type == "infrastructure":
        stmt = stmt.where(Asset.asset_class == AssetClass.infrastructure)
    elif body.scope_type == "by_location":
        if not body.location:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "by_location 需要 location")
        stmt = stmt.where(Asset.location == body.location)
    elif body.scope_type == "by_department":
        if not body.department_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "by_department 需要 department_id"
            )
        stmt = stmt.where(Asset.department_id == body.department_id)
    return stmt


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(body: CreateIn, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    """Snapshot assets matching the chosen scope into a stocktake task."""
    task = InspectionTask(
        name=body.name, scope_type=body.scope_type, created_by=user.id
    )
    db.add(task)
    db.flush()
    assets = db.scalars(_scope_query(body)).all()
    for a in assets:
        db.add(
            InspectionItem(task_id=task.id, asset_id=a.id, expected_owner_id=a.owner_user_id)
        )
    db.commit()
    return {
        "id": task.id, "name": task.name, "scope_type": task.scope_type,
        "item_count": len(assets),
    }


def _progress(db: Session, task_id: int) -> dict[str, int]:
    agg = dict(
        db.execute(
            select(InspectionItem.confirm_status, func.count())
            .where(InspectionItem.task_id == task_id)
            .group_by(InspectionItem.confirm_status)
        ).all()
    )
    return {s.value: int(agg.get(s, 0)) for s in ConfirmStatus}


@router.get("")
def list_tasks(db: Session = Depends(get_db), _: User = Depends(it_admin)):
    rows = db.scalars(
        select(InspectionTask).order_by(InspectionTask.started_at.desc())
    ).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "scope_type": t.scope_type,
            "status": t.status.value,
            "started_at": t.started_at.isoformat() if t.started_at else None,
            "ended_at": t.ended_at.isoformat() if t.ended_at else None,
            "progress": _progress(db, t.id),
        }
        for t in rows
    ]


def _item_rows(db: Session, task_id: int, only_mismatch: bool = False):
    stmt = (
        select(
            InspectionItem,
            Asset.asset_code, Asset.brand_model, Asset.owner_name, Asset.status,
            Asset.location,
        )
        .join(Asset, Asset.id == InspectionItem.asset_id)
        .where(InspectionItem.task_id == task_id)
    )
    if only_mismatch:
        stmt = stmt.where(InspectionItem.confirm_status == ConfirmStatus.mismatch)
    out = []
    for it, code, brand, owner, st, loc in db.execute(stmt).all():
        out.append({
            "asset_code": code,
            "brand_model": brand,
            "owner_name": owner,
            "asset_status": st.value if st else None,
            "location": loc,
            "confirm_status": it.confirm_status.value,
            "expected_owner_id": it.expected_owner_id,
            "remark": it.remark,
        })
    return out


@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db), _: User = Depends(it_admin)):
    task = db.get(InspectionTask, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    return {
        "id": task.id,
        "name": task.name,
        "scope_type": task.scope_type,
        "status": task.status.value,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "ended_at": task.ended_at.isoformat() if task.ended_at else None,
        "progress": _progress(db, task_id),
        "items": _item_rows(db, task_id),
    }


@router.get("/{task_id}/mismatches")
def get_mismatches(
    task_id: int, db: Session = Depends(get_db), _: User = Depends(it_admin)
):
    task = db.get(InspectionTask, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    return _item_rows(db, task_id, only_mismatch=True)


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
