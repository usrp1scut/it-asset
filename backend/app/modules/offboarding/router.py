"""Offboarding (离职归还) — case view over a departing employee's assets.

Manual creation here; the Lark `user.left` event hook + the daily overdue
Celery scan land in a follow-up. Returns reuse the asset return flow; a
registered loss raises a scrap request for finance write-off.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.offboarding import service
from app.modules.offboarding.models import OffboardingCase, OffboardingItem, OffboardingItemStatus
from app.modules.offboarding.schemas import (
    CaseCreate,
    CaseDetail,
    CaseOut,
    ItemLostIn,
    ItemOut,
    ItemReturnIn,
)
from app.modules.users.models import Role, User

router = APIRouter(prefix="/api/offboarding", tags=["offboarding"])
staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)
it_admin = require_roles(Role.it_admin)


def _summary(items: list[OffboardingItem]) -> dict:
    total = len(items)
    returned = sum(1 for i in items if i.status == OffboardingItemStatus.returned)
    lost = sum(1 for i in items if i.status == OffboardingItemStatus.lost)
    pending = sum(1 for i in items if i.status == OffboardingItemStatus.return_pending)
    total_value = sum((i.snapshot_value or Decimal(0) for i in items), Decimal(0))
    pending_value = sum(
        (
            i.snapshot_value or Decimal(0)
            for i in items
            if i.status == OffboardingItemStatus.return_pending
        ),
        Decimal(0),
    )
    return {
        "total_items": total,
        "returned_items": returned,
        "lost_items": lost,
        "pending_items": pending,
        "total_value": total_value,
        "pending_value": pending_value,
    }


def _case_out(db: Session, case: OffboardingCase) -> CaseOut:
    o = CaseOut.model_validate(case)
    for k, v in _summary(service.items_of(db, case.id)).items():
        setattr(o, k, v)
    return o


@router.get("", response_model=list[CaseOut])
def list_cases(status_: str | None = None, db: Session = Depends(get_db), _: User = Depends(staff)):
    return [_case_out(db, c) for c in service.list_cases(db, status_)]


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(case_id: int, db: Session = Depends(get_db), _: User = Depends(staff)):
    case = service.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "工单不存在")
    items = service.items_of(db, case_id)
    out = CaseDetail.model_validate(case)
    for k, v in _summary(items).items():
        setattr(out, k, v)
    out.items = [ItemOut.model_validate(i) for i in items]
    return out


@router.post("", response_model=CaseDetail, status_code=status.HTTP_201_CREATED)
def create_case(body: CaseCreate, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    try:
        case = service.create_case(
            db,
            user_id=body.user_id,
            last_day=body.last_day,
            reason=body.reason,
            channel="manual",
            created_by=user.id,
        )
    except service.OffboardingError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="offboarding.create",
                resource_type="offboarding_case", resource_id=case.case_no)
    return get_case(case.id, db, user)


@router.post("/{case_id}/items/{code}/return", response_model=CaseDetail)
def return_item(
    case_id: int, code: str, body: ItemReturnIn, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    case = service.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "工单不存在")
    try:
        service.return_item(
            db, case, code,
            condition=body.condition.value, remark=body.remark, operator_id=user.id,
        )
    except service.OffboardingError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="offboarding.return",
                resource_type="offboarding_case", resource_id=case.case_no, payload={"asset": code})
    return get_case(case_id, db, user)


@router.post("/{case_id}/items/{code}/lost", response_model=CaseDetail)
def lost_item(
    case_id: int, code: str, body: ItemLostIn, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    case = service.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "工单不存在")
    try:
        service.lost_item(db, case, code, remark=body.remark, operator_id=user.id)
    except service.OffboardingError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="offboarding.lost",
                resource_type="offboarding_case", resource_id=case.case_no, payload={"asset": code})
    return get_case(case_id, db, user)


@router.post("/{case_id}/notify", response_model=CaseDetail)
def notify_leaver(case_id: int, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    """IT confirms the case and notifies the leaver (+ manager) to return
    assets. Auto-created cases stay silent to the employee until this runs."""
    case = service.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "工单不存在")
    service.notify_leaver(db, case, user.id)
    write_audit(db, actor_user_id=user.id, action="offboarding.notify",
                resource_type="offboarding_case", resource_id=case.case_no)
    return get_case(case_id, db, user)


@router.post("/{case_id}/close", response_model=CaseDetail)
def close_case(case_id: int, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    case = service.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "工单不存在")
    try:
        service.close_case(db, case)
    except service.OffboardingError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="offboarding.close",
                resource_type="offboarding_case", resource_id=case.case_no)
    return get_case(case_id, db, user)


@router.post("/scan-overdue")
def scan_overdue(db: Session = Depends(get_db), user: User = Depends(it_admin)):
    """Manual trigger for the daily overdue scan (until the Celery job lands)."""
    n = service.scan_overdue(db)
    return {"flipped": n}
