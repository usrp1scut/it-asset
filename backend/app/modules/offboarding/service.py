import uuid
from datetime import UTC, date, datetime

import anyio
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.lark.client import get_lark_client
from app.modules.assets import scrap_workflow
from app.modules.assets import service as asset_service
from app.modules.assets.models import Asset, AssetClass, AssetStatus
from app.modules.assets.scrap_workflow import IllegalScrapTransition
from app.modules.offboarding.models import (
    ItemCondition,
    OffboardingCase,
    OffboardingItem,
    OffboardingItemStatus,
    OffboardingStatus,
)
from app.modules.users.models import Department, User


class OffboardingError(ValueError):
    pass


# ── Lark notify (no-op-safe; never raise into business code) ─────────────────
# Auto-creation only ever pings IT — the leaver/manager are messaged solely
# from notify_leaver(), which an admin triggers after eyeballing the case.

def _alert_it(text: str) -> None:
    s = get_settings()
    c = get_lark_client()
    if not c.configured or not s.lark_alert_chat_id:
        return
    try:
        anyio.run(c.send_text, s.lark_alert_chat_id, text)
    except Exception:  # noqa: BLE001 — notification must not break the flow
        pass


def _dm(open_id: str | None, text: str) -> None:
    c = get_lark_client()
    if not c.configured or not open_id:
        return
    try:
        anyio.run(c.send_user, open_id, text)
    except Exception:  # noqa: BLE001
        pass


def _case_no() -> str:
    return f"OFF-{datetime.now(UTC).year}-{uuid.uuid4().hex[:6].upper()}"


def list_cases(db: Session, status: str | None = None) -> list[OffboardingCase]:
    stmt = select(OffboardingCase).order_by(OffboardingCase.created_at.desc())
    if status:
        stmt = stmt.where(OffboardingCase.status == status)
    return list(db.scalars(stmt).all())


def get_case(db: Session, case_id: int) -> OffboardingCase | None:
    return db.get(OffboardingCase, case_id)


def items_of(db: Session, case_id: int) -> list[OffboardingItem]:
    return list(
        db.scalars(
            select(OffboardingItem)
            .where(OffboardingItem.case_id == case_id)
            .order_by(OffboardingItem.id)
        ).all()
    )


def create_case(
    db: Session,
    *,
    user_id: int,
    last_day: date | None,
    reason: str | None,
    channel: str,
    created_by: int | None,
    alert_it: bool = True,
) -> OffboardingCase:
    user = db.get(User, user_id)
    if user is None:
        raise OffboardingError("员工不存在")
    existing = db.scalar(
        select(OffboardingCase).where(
            OffboardingCase.user_id == user_id,
            OffboardingCase.status != OffboardingStatus.completed,
        )
    )
    if existing:
        raise OffboardingError("该员工已有进行中的离职归还工单")

    dept_name = None
    if user.department_id:
        d = db.get(Department, user.department_id)
        dept_name = d.name if d else None

    case = OffboardingCase(
        case_no=_case_no(),
        user_id=user_id,
        user_name=user.name,
        department_name=dept_name,
        last_day=last_day,
        reason=reason,
        hr_channel=channel,
        created_by=created_by,
        assigned_it_id=created_by,
    )
    db.add(case)
    db.flush()

    # Snapshot the user's in-use personal assets as items to return.
    assets = db.scalars(
        select(Asset).where(
            Asset.owner_user_id == user_id,
            Asset.status == AssetStatus.in_use,
            Asset.asset_class == AssetClass.personal,
            Asset.deleted_at.is_(None),
        )
    ).all()
    for a in assets:
        db.add(
            OffboardingItem(
                case_id=case.id,
                asset_id=a.id,
                asset_code=a.asset_code,
                brand_model=a.brand_model,
                snapshot_value=a.purchase_price,
                status=OffboardingItemStatus.return_pending,
            )
        )
    db.commit()
    db.refresh(case)

    # Ping IT only — the leaver is contacted later via notify_leaver (the
    # explicit IT-confirmation gate), so a mistaken trigger doesn't spam them.
    if alert_it:
        n = len(assets)
        src = "Lark 离职事件" if channel.startswith("lark_event") else "手工建单"
        _alert_it(
            f"【离职归还 · 待确认】{case.case_no}({src})\n"
            f"员工 {user.name}{(' · ' + dept_name) if dept_name else ''},名下 {n} 件在用资产。"
            f"\n请在系统核对后点「确认并通知员工」。"
        )
    return case


def notify_leaver(db: Session, case: OffboardingCase, operator_id: int | None) -> OffboardingCase:
    """IT-confirmed gate: message the leaver (and their manager) to return
    assets, and stamp notified_at. Idempotent — re-notifying is a no-op."""
    if case.notified_at is not None:
        return case
    user = db.get(User, case.user_id)
    pending = _count_pending(db, case.id)
    if user is not None:
        _dm(
            user.lark_open_id,
            f"【资产归还提醒】{user.name} 你好,离职流程已启动。请尽快归还名下 {pending} 件 IT 资产,"
            f"并配合 IT 完成验收(工单 {case.case_no})。",
        )
        if user.manager_user_id:
            mgr = db.get(User, user.manager_user_id)
            if mgr is not None:
                _dm(
                    mgr.lark_open_id,
                    f"你的下属 {user.name} 离职,名下还有 {pending} 件 IT 资产待归还,请协助督促(工单 {case.case_no})。",
                )
    case.notified_at = func.now()
    db.commit()
    db.refresh(case)
    return case


def create_from_lark(
    db: Session, *, lark_open_id: str | None = None, lark_user_id: str | None = None
) -> OffboardingCase | None:
    """Auto-create a case from a Lark `user.left`/`user.deleted` event.
    Best-effort: returns None when the user isn't found or already has a case.
    Alerts IT; never messages the (departing) employee."""
    stmt = select(User)
    if lark_open_id:
        stmt = stmt.where(User.lark_open_id == lark_open_id)
    elif lark_user_id:
        stmt = stmt.where(User.lark_user_id == lark_user_id)
    else:
        return None
    user = db.scalar(stmt)
    if user is None:
        return None
    try:
        return create_case(
            db,
            user_id=user.id,
            last_day=date.today(),
            reason="Lark 离职事件自动建单",
            channel="lark_event:user.left",
            created_by=None,
            alert_it=True,
        )
    except OffboardingError:
        return None  # already has an open case


def _item_or_err(db: Session, case_id: int, code: str) -> OffboardingItem:
    it = db.scalar(
        select(OffboardingItem).where(
            OffboardingItem.case_id == case_id, OffboardingItem.asset_code == code
        )
    )
    if it is None:
        raise OffboardingError("工单中无此资产")
    return it


def _recompute(db: Session, case: OffboardingCase) -> None:
    """An overdue case drops back to in_progress once nothing's pending."""
    pending = _count_pending(db, case.id)
    if pending == 0 and case.status == OffboardingStatus.overdue:
        case.status = OffboardingStatus.in_progress


def _count_pending(db: Session, case_id: int) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(OffboardingItem)
            .where(
                OffboardingItem.case_id == case_id,
                OffboardingItem.status == OffboardingItemStatus.return_pending,
            )
        )
        or 0
    )


def return_item(
    db: Session,
    case: OffboardingCase,
    code: str,
    *,
    condition: str | None,
    remark: str | None,
    operator_id: int,
) -> OffboardingItem:
    it = _item_or_err(db, case.id, code)
    if it.status == OffboardingItemStatus.returned:
        return it
    asset = db.get(Asset, it.asset_id)
    # Reuse the asset return flow (clears owner, in_use → idle, logs).
    if asset is not None and asset.status == AssetStatus.in_use:
        asset_service.return_asset(db, asset, operator_id, f"离职归还 {case.case_no}")
    it.status = OffboardingItemStatus.returned
    it.condition = ItemCondition(condition) if condition else ItemCondition.good
    it.returned_at = func.now()
    it.handler_id = operator_id
    it.remark = remark
    _recompute(db, case)
    db.commit()
    db.refresh(it)
    return it


def lost_item(
    db: Session,
    case: OffboardingCase,
    code: str,
    *,
    remark: str | None,
    operator_id: int,
) -> OffboardingItem:
    it = _item_or_err(db, case.id, code)
    asset = db.get(Asset, it.asset_id)
    # Registering a loss raises a scrap request so finance writes it off; the
    # asset stays put until that's disposed (PHASE3 §2.8).
    if asset is not None:
        note = f"员工离职丢失 · {case.case_no}" + (f" · {remark}" if remark else "")
        try:
            scrap_workflow.submit_request(db, asset, operator_id, note)
        except IllegalScrapTransition:
            pass  # already scrapped or has an open scrap request — fine
    it.status = OffboardingItemStatus.lost
    it.returned_at = func.now()
    it.handler_id = operator_id
    it.remark = remark
    _recompute(db, case)
    db.commit()
    db.refresh(it)
    return it


def close_case(db: Session, case: OffboardingCase) -> OffboardingCase:
    pending = _count_pending(db, case.id)
    if pending:
        raise OffboardingError(f"还有 {pending} 件资产待归还,无法关闭")
    case.status = OffboardingStatus.completed
    case.completed_at = func.now()
    db.commit()
    db.refresh(case)
    return case


def scan_overdue(db: Session) -> int:
    """Mark in-progress cases past their last day (with pending items) overdue.
    Returns how many were flipped. Wired to a daily Celery job later."""
    today = date.today()
    cases = db.scalars(
        select(OffboardingCase).where(OffboardingCase.status == OffboardingStatus.in_progress)
    ).all()
    flipped = 0
    for c in cases:
        if c.last_day and c.last_day < today and _count_pending(db, c.id) > 0:
            c.status = OffboardingStatus.overdue
            flipped += 1
    if flipped:
        db.commit()
    return flipped
