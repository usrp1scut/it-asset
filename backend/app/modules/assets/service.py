from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.assets.models import (
    Asset,
    AssetAccessory,
    AssetAssignment,
    AssetChangeLog,
    AssetCodeCounter,
    AssetStatus,
)
from app.modules.assets.state_machine import (
    IllegalTransition,
    assert_assignable,
    assert_transition,
)
from app.modules.users.models import Department, User


def _apply_owner(db: Session, asset: Asset, user_id: int) -> None:
    """Bind owner to a real user: backfill display name + department from the
    directory and clear needs_review (an explicit assignment is the human
    reconciliation the Phase-0 review queue was waiting for)."""
    user = db.get(User, user_id)
    if user is None:
        raise IllegalTransition("目标员工不存在")
    asset.owner_user_id = user_id
    asset.owner_name = user.name
    if user.department_id:
        asset.department_id = user.department_id
        dept = db.get(Department, user.department_id)
        if dept is not None:
            asset.department_name = dept.name
    asset.needs_review = False


def _clear_owner(asset: Asset) -> None:
    """Owner gone (return/scrap) — don't leave stale责任人 text behind."""
    asset.owner_user_id = None
    asset.owner_name = None


def generate_asset_code(db: Session, prefix: str) -> str:
    """Allocate the next asset code for `prefix`, concurrency-safe.

    Locks the counter row (SELECT … FOR UPDATE) so parallel creates can't
    collide. Explicitly NOT max(code)+1 (PRD §13.1).
    """
    prefix = prefix.upper()
    counter = db.execute(
        select(AssetCodeCounter).where(AssetCodeCounter.prefix == prefix).with_for_update()
    ).scalar_one_or_none()
    if counter is None:
        counter = AssetCodeCounter(prefix=prefix, next_val=1)
        db.add(counter)
        db.flush()
    n = counter.next_val
    counter.next_val = n + 1
    db.flush()
    return f"{prefix}-{n:04d}"


def _log(
    db: Session,
    asset: Asset,
    action: str,
    *,
    from_status: str | None = None,
    to_status: str | None = None,
    from_owner: int | None = None,
    to_owner: int | None = None,
    operator_id: int | None = None,
    reason: str | None = None,
) -> None:
    db.add(
        AssetChangeLog(
            asset_id=asset.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            from_owner_id=from_owner,
            to_owner_id=to_owner,
            operator_id=operator_id,
            reason=reason,
        )
    )


def create_asset(db: Session, data: dict, prefix: str, operator_id: int | None) -> Asset:
    asset = Asset(**data)
    if not asset.asset_code:
        asset.asset_code = generate_asset_code(db, prefix)
    asset.created_by = operator_id
    db.add(asset)
    db.flush()
    _log(db, asset, "create", to_status=asset.status, operator_id=operator_id)
    db.commit()
    db.refresh(asset)
    return asset


def list_assets(
    db: Session,
    *,
    status: str | None = None,
    asset_class: str | None = None,
    type_id: int | None = None,
    department_id: int | None = None,
    q: str | None = None,
    needs_review: bool | None = None,
    scrap_candidate: bool | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[int, list[Asset]]:
    stmt = select(Asset).where(Asset.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Asset.status == status)
    if asset_class:
        stmt = stmt.where(Asset.asset_class == asset_class)
    if type_id:
        stmt = stmt.where(Asset.asset_type_id == type_id)
    if department_id:
        stmt = stmt.where(Asset.department_id == department_id)
    if needs_review is not None:
        stmt = stmt.where(Asset.needs_review.is_(needs_review))
    if scrap_candidate is not None:
        stmt = stmt.where(Asset.scrap_candidate.is_(scrap_candidate))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            Asset.asset_code.ilike(like)
            | Asset.brand_model.ilike(like)
            | Asset.serial_number.ilike(like)
            | Asset.owner_name.ilike(like)
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Asset.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    return total, list(rows)


def get_asset(db: Session, code: str) -> Asset | None:
    return db.scalar(
        select(Asset).where(Asset.asset_code == code, Asset.deleted_at.is_(None))
    )


def lifecycle(db: Session, asset_id: int) -> list[AssetChangeLog]:
    return list(
        db.scalars(
            select(AssetChangeLog)
            .where(AssetChangeLog.asset_id == asset_id)
            .order_by(AssetChangeLog.created_at.desc())
        ).all()
    )


def accessories(db: Session, asset_id: int) -> list[AssetAccessory]:
    return list(
        db.scalars(select(AssetAccessory).where(AssetAccessory.asset_id == asset_id)).all()
    )


# ── status actions ───────────────────────────────────────────────────────────


def assign(db: Session, asset: Asset, user_id: int, operator_id: int, note: str | None) -> Asset:
    assert_assignable(asset.asset_class)
    assert_transition(asset.status, AssetStatus.in_use)
    prev_owner = asset.owner_user_id
    asset.status = AssetStatus.in_use
    _apply_owner(db, asset, user_id)
    db.add(
        AssetAssignment(
            asset_id=asset.id, user_id=user_id, operator_id=operator_id, remark=note
        )
    )
    _log(
        db, asset, "assign",
        from_status=AssetStatus.idle, to_status=AssetStatus.in_use,
        from_owner=prev_owner, to_owner=user_id, operator_id=operator_id, reason=note,
    )
    db.commit()
    db.refresh(asset)
    return asset


def return_asset(db: Session, asset: Asset, operator_id: int, note: str | None) -> Asset:
    assert_assignable(asset.asset_class)
    assert_transition(asset.status, AssetStatus.idle)
    prev_owner = asset.owner_user_id
    asset.status = AssetStatus.idle
    _clear_owner(asset)
    active = db.scalar(
        select(AssetAssignment).where(
            AssetAssignment.asset_id == asset.id, AssetAssignment.status == "active"
        )
    )
    if active:
        active.status = "returned"
        active.returned_at = func.now()
    _log(
        db, asset, "return",
        from_status=AssetStatus.in_use, to_status=AssetStatus.idle,
        from_owner=prev_owner, operator_id=operator_id, reason=note,
    )
    db.commit()
    db.refresh(asset)
    return asset


def transfer(
    db: Session, asset: Asset, to_user_id: int, operator_id: int, reason: str | None
) -> Asset:
    """Reassign an in-use personal asset to another employee (stays in_use)."""
    assert_assignable(asset.asset_class)
    if asset.status != AssetStatus.in_use:
        raise IllegalTransition("仅在用资产可转移")
    prev_owner = asset.owner_user_id
    _apply_owner(db, asset, to_user_id)
    active = db.scalar(
        select(AssetAssignment).where(
            AssetAssignment.asset_id == asset.id, AssetAssignment.status == "active"
        )
    )
    if active:
        active.status = "returned"
        active.returned_at = func.now()
    db.add(
        AssetAssignment(
            asset_id=asset.id, user_id=to_user_id, operator_id=operator_id, remark=reason
        )
    )
    _log(
        db, asset, "transfer",
        from_status=AssetStatus.in_use, to_status=AssetStatus.in_use,
        from_owner=prev_owner, to_owner=to_user_id, operator_id=operator_id, reason=reason,
    )
    db.commit()
    db.refresh(asset)
    return asset


def repair(db: Session, asset: Asset, operator_id: int, reason: str | None) -> Asset:
    assert_transition(asset.status, AssetStatus.maintenance)
    prev = asset.status
    asset.status = AssetStatus.maintenance
    _log(db, asset, "repair", from_status=prev, to_status=AssetStatus.maintenance,
         operator_id=operator_id, reason=reason)
    db.commit()
    db.refresh(asset)
    return asset


def scrap(db: Session, asset: Asset, operator_id: int, reason: str | None) -> Asset:
    assert_transition(asset.status, AssetStatus.scrapped)
    prev = asset.status
    asset.status = AssetStatus.scrapped
    _clear_owner(asset)
    _log(db, asset, "scrap", from_status=prev, to_status=AssetStatus.scrapped,
         operator_id=operator_id, reason=reason)
    db.commit()
    db.refresh(asset)
    return asset


def bind_accessories(db: Session, main: Asset, child_ids: list[int]) -> None:
    for cid in child_ids:
        db.add(AssetAccessory(asset_id=main.id, asset_accessory_id=cid))
    _log(db, main, "bind_accessory", operator_id=None,
         reason=f"绑定配件 {len(child_ids)} 件")
    db.commit()
