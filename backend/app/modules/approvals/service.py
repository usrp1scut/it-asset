import uuid

import anyio
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.lark.client import get_lark_client
from app.modules.approvals.models import ApprovalRequest, ApprovalStatus, RequestType
from app.modules.inventory.service import InsufficientStock, issue
from app.modules.users.models import User


class ApprovalError(ValueError):
    pass


def _notify(text: str) -> None:
    """Best-effort Lark push to the alert chat. Never raises."""
    settings = get_settings()
    client = get_lark_client()
    if not client.configured or not settings.lark_alert_chat_id:
        return
    try:
        anyio.run(client.send_text, settings.lark_alert_chat_id, text)
    except Exception:  # noqa: BLE001 — notification must never break the flow
        return


def create_request(
    db: Session, *, requester: User, request_type: RequestType, payload: dict
) -> ApprovalRequest:
    req = ApprovalRequest(
        request_no=f"AP-{uuid.uuid4().hex[:10].upper()}",
        request_type=request_type,
        requester_id=requester.id,
        approver_id=requester.manager_user_id,
        status=ApprovalStatus.pending,
        payload_json=payload,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    _notify(f"新申请待审批 {req.request_no}:{requester.name} · {request_type.value}")
    return req


def _load(db: Session, req_id: int) -> ApprovalRequest:
    req = db.get(ApprovalRequest, req_id)
    if req is None:
        raise ApprovalError("申请不存在")
    return req


def approve(db: Session, req_id: int, operator: User) -> ApprovalRequest:
    req = _load(db, req_id)
    if req.status != ApprovalStatus.pending:
        raise ApprovalError(f"当前状态 {req.status} 不可审批")
    req.status = ApprovalStatus.approved
    req.decided_by = operator.id
    db.commit()
    db.refresh(req)
    _notify(f"申请 {req.request_no} 已通过,待 IT 发放")
    return req


def reject(db: Session, req_id: int, operator: User) -> ApprovalRequest:
    req = _load(db, req_id)
    if req.status != ApprovalStatus.pending:
        raise ApprovalError(f"当前状态 {req.status} 不可审批")
    req.status = ApprovalStatus.rejected
    req.decided_by = operator.id
    db.commit()
    db.refresh(req)
    return req


def fulfill(db: Session, req_id: int, operator: User) -> ApprovalRequest:
    """IT 发放。耗材类自动扣库存(并发安全,见 inventory.service)。"""
    req = _load(db, req_id)
    if req.status != ApprovalStatus.approved:
        raise ApprovalError(f"当前状态 {req.status} 不可发放")

    if req.request_type == RequestType.consumable:
        for item in req.payload_json.get("items", []):
            issue(
                db,
                sku_id=item["sku_id"],
                quantity=item["qty"],
                user_id=req.requester_id,
                location_id=None,
                operator_id=operator.id,
                remark=f"审批发放 {req.request_no}",
            )
    # asset 类:IT 在资产台账手工分配,这里仅置完成
    req.status = ApprovalStatus.fulfilled
    req.fulfilled_by = operator.id
    db.commit()
    db.refresh(req)
    return req


def list_for_approver(db: Session, user: User) -> list[ApprovalRequest]:
    return list(
        db.scalars(
            select(ApprovalRequest)
            .where(ApprovalRequest.status.in_([ApprovalStatus.pending, ApprovalStatus.approved]))
            .order_by(ApprovalRequest.created_at.desc())
        ).all()
    )


def list_mine(db: Session, user: User) -> list[ApprovalRequest]:
    return list(
        db.scalars(
            select(ApprovalRequest)
            .where(ApprovalRequest.requester_id == user.id)
            .order_by(ApprovalRequest.created_at.desc())
        ).all()
    )


__all__ = [
    "ApprovalError",
    "InsufficientStock",
    "create_request",
    "approve",
    "reject",
    "fulfill",
    "list_for_approver",
    "list_mine",
]
