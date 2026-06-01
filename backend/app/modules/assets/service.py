from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.modules.assets.models import (
    Asset,
    AssetAccessory,
    AssetAssignment,
    AssetChangeLog,
    AssetClass,
    AssetCodeCounter,
    AssetStatus,
    AssetType,
)
from app.modules.assets.state_machine import (
    IllegalTransition,
    assert_assignable,
    assert_transition,
)
from app.modules.users.models import Department, User


def qr_payload(asset_code: str) -> str:
    """QR payload: deep-link URL if PUBLIC_BASE_URL configured, else plain code."""
    base = get_settings().public_base_url.rstrip("/")
    return f"{base}/assets?code={asset_code}" if base else asset_code


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


def _max_seq_for_prefix(db: Session, prefix: str) -> int:
    """Highest numeric suffix among existing ``PREFIX-####`` codes (0 if none).

    Soft-deleted assets are included on purpose: their code still occupies
    the UNIQUE index, so we must not re-issue it. Odd imported codes that
    don't match ``PREFIX-<digits>`` (e.g. ``PC-A1``) are ignored — they can't
    contribute a numeric floor.
    """
    best = 0
    for code in db.scalars(
        select(Asset.asset_code).where(Asset.asset_code.like(f"{prefix}-%"))
    ):
        tail = code.split("-", 1)[1]
        if tail.isdigit():
            best = max(best, int(tail))
    return best


def generate_asset_code(db: Session, prefix: str) -> str:
    """Allocate the next asset code for `prefix`, concurrency-safe.

    Locks the counter row (SELECT … FOR UPDATE) so parallel creates can't
    collide. The counter drives numbering and gaps are fine — explicitly NOT
    plain max(code)+1 (PRD §13.1).

    Hardening: the next number is additionally floored at
    ``(existing max for this prefix) + 1``. That makes auto-allocation
    collision-proof against (a) a counter that started behind already-migrated
    data, and (b) a manually entered / imported code (importer honours an
    explicit ``资产编号`` without bumping the counter). Since ``asset_code`` is
    UNIQUE, a collision would otherwise hard-fail the create. The floor read
    happens inside the row lock, so it's atomic w.r.t. concurrent allocations
    of the same prefix.
    """
    prefix = prefix.upper()
    counter = db.execute(
        select(AssetCodeCounter).where(AssetCodeCounter.prefix == prefix).with_for_update()
    ).scalar_one_or_none()
    if counter is None:
        counter = AssetCodeCounter(prefix=prefix, next_val=1)
        db.add(counter)
        db.flush()
    n = max(counter.next_val, _max_seq_for_prefix(db, prefix) + 1)
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


def change_type(
    db: Session, asset: Asset, new_type: AssetType, operator_id: int | None
) -> Asset:
    """Move an asset to a different AssetType.

    Side effects (intentional — see edit-flow decision):
    - asset_class follows the new type (the type is the source of truth);
    - if the new type's prefix differs from the current code's prefix, the
      asset is **re-coded** with a fresh sequence number under the new prefix
      (PC-0001 → MON-0007). The id is unchanged, so every FK relation
      (assignments, change-logs, accessories, repair/scrap/inspection rows)
      stays intact — only the human-facing code (and thus its QR) changes.

    Guard: an infrastructure type can't hold an assigned owner (infra assets
    aren't assignable), so refuse until the asset is returned/transferred.
    """
    if new_type.asset_class == AssetClass.infrastructure and asset.owner_user_id is not None:
        raise IllegalTransition(
            "该资产已分配给员工,请先归还 / 转移后再改为基础设施类型"
        )

    old_code = asset.asset_code
    old_prefix = (old_code.split("-", 1)[0] if "-" in old_code else old_code).upper()
    new_prefix = new_type.code_prefix.upper()

    asset.asset_type_id = new_type.id
    asset.asset_class = new_type.asset_class
    if new_prefix != old_prefix:
        asset.asset_code = generate_asset_code(db, new_prefix)

    _log(
        db, asset, "change_type", operator_id=operator_id,
        reason=f"{old_code} → {asset.asset_code}",
    )
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
    # Case-insensitive + whitespace-tolerant — a scanned sticker can come
    # back as "pc-0099" or " PC-0099 " depending on the QR generator and
    # whatever wrappers (path segment, query value) we strip on the way in.
    needle = (code or "").strip()
    if not needle:
        return None
    return db.scalar(
        select(Asset).where(
            Asset.asset_code.ilike(needle),
            Asset.deleted_at.is_(None),
        )
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


def set_status(
    db: Session,
    asset: Asset,
    target: AssetStatus,
    operator_id: int | None,
    note: str | None = None,
) -> Asset:
    """Direct status change for **infrastructure** assets.

    Infra has no owner, so it never goes through assign/return — it moves
    between idle / in_use / maintenance directly (启用 / 停用 / 修复完成).
    Personal assets must keep using assign/return/repair/scrap so owner and
    assignment rows stay consistent; calling this on one is refused.
    Scrapping always goes through the dedicated scrap flow.
    """
    if asset.asset_class != AssetClass.infrastructure:
        raise IllegalTransition("个人资产请通过 分配 / 归还 / 报修 / 报废 变更状态")
    if target == AssetStatus.scrapped:
        raise IllegalTransition("报废请走报废流程")
    assert_transition(asset.status, target)
    prev = asset.status
    asset.status = target
    _log(db, asset, "status_change", from_status=prev, to_status=target,
         operator_id=operator_id, reason=note)
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset(db: Session, asset: Asset, operator_id: int | None) -> None:
    """Soft-delete — set deleted_at so the asset drops out of every query.

    The row stays in the DB (recoverable, keeps change-log / FK integrity
    with inspections, repair orders, scrap requests that still point at it).
    """
    asset.deleted_at = func.now()
    _log(db, asset, "delete", from_status=asset.status, operator_id=operator_id)
    db.commit()


def bind_accessories(db: Session, main: Asset, child_ids: list[int]) -> None:
    for cid in child_ids:
        db.add(AssetAccessory(asset_id=main.id, asset_accessory_id=cid))
    _log(db, main, "bind_accessory", operator_id=None,
         reason=f"绑定配件 {len(child_ids)} 件")
    db.commit()


def reconcile_asset_owners(db: Session) -> dict[str, int]:
    """Keep asset owner data aligned with the directory on every contact sync:

      * unlinked assets carrying only a free-text owner_name → fuzzy-match it
        (Chinese / English / pinyin / email, unique hits only) and bind the
        directory user; a confidently bound owner also clears needs_review;
      * assets with a linked owner → refresh the owner_name / department
        display snapshot (tracks directory renames, newly added aliases).

    Returns {"linked": M, "refreshed": N}.
    """
    from app.modules.assets.matching import build_user_index

    index = build_user_index(db)
    dept_names: dict[int, str] = {}
    linked = refreshed = 0
    assets = db.scalars(select(Asset).where(Asset.deleted_at.is_(None))).all()
    for asset in assets:
        newly_linked = False
        if asset.owner_user_id is None:
            if not asset.owner_name:
                continue
            uid = index.resolve(asset.owner_name)
            if uid is None:
                continue  # no match, or ambiguous → leave it for a human
            asset.owner_user_id = uid
            asset.needs_review = False
            newly_linked = True
        user = db.get(User, asset.owner_user_id)
        if user is None:
            continue
        dirty = False
        if asset.owner_name != user.name:
            asset.owner_name = user.name
            dirty = True
        if user.department_id and asset.department_id != user.department_id:
            asset.department_id = user.department_id
            if user.department_id not in dept_names:
                d = db.get(Department, user.department_id)
                dept_names[user.department_id] = d.name if d else ""
            asset.department_name = dept_names[user.department_id]
            dirty = True
        if newly_linked:
            linked += 1
        elif dirty:
            refreshed += 1
    db.commit()
    return {"linked": linked, "refreshed": refreshed}
