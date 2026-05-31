import uuid

import anyio
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.lark.client import get_lark_client
from app.modules.approvals.models import (
    ApprovalRequest,
    ApprovalStatus,
    AutoApprovalRule,
    RequestType,
)
from app.modules.inventory.models import Sku
from app.modules.inventory.service import InsufficientStock, issue
from app.modules.users.models import User


class ApprovalError(ValueError):
    pass


def get_auto_rule(db: Session) -> AutoApprovalRule:
    rule = db.get(AutoApprovalRule, 1)
    if rule is None:
        rule = AutoApprovalRule(id=1)
        db.add(rule)
        db.commit()
        db.refresh(rule)
    return rule


def _auto_decide(db: Session, req: ApprovalRequest) -> bool:
    """If the auto-approval rule is on and this request matches, approve it in
    place (status → approved, awaiting IT 发放). Returns whether it fired."""
    rule = get_auto_rule(db)
    if not rule.enabled:
        return False
    if rule.consumable_only and req.request_type != RequestType.consumable:
        return False
    items = (req.payload_json or {}).get("items", [])
    sku_ids = [it["sku_id"] for it in items if it.get("sku_id")]
    skus = {s.id: s for s in db.scalars(select(Sku).where(Sku.id.in_(sku_ids)))} if sku_ids else {}
    if rule.respect_sku_flag and any(
        (s := skus.get(it.get("sku_id"))) is not None and s.need_approval for it in items
    ):
        return False
    total_qty = sum(int(it.get("qty", 0)) for it in items)
    if rule.max_total_qty is not None and total_qty > rule.max_total_qty:
        return False
    total_amount = sum(
        (skus[it["sku_id"]].price or 0) * int(it.get("qty", 0))
        for it in items
        if it.get("sku_id") in skus
    )
    if rule.max_total_amount is not None and total_amount > rule.max_total_amount:
        return False
    req.status = ApprovalStatus.approved
    req.decided_at = func.now()
    req.auto_approved = True
    req.decision_note = "系统自动审批(命中自动审批规则)"
    return True


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
    db.flush()
    auto = _auto_decide(db, req)
    db.commit()
    db.refresh(req)
    if auto:
        _notify(f"申请 {req.request_no} 已自动审批通过(规则),待 IT 发放")
    else:
        _notify(f"新申请待审批 {req.request_no}:{requester.name} · {request_type.value}")
    return req


def _load(db: Session, req_id: int) -> ApprovalRequest:
    req = db.get(ApprovalRequest, req_id)
    if req is None:
        raise ApprovalError("申请不存在")
    return req


def approve(db: Session, req_id: int, operator: User, note: str | None = None) -> ApprovalRequest:
    req = _load(db, req_id)
    if req.status != ApprovalStatus.pending:
        raise ApprovalError(f"当前状态 {req.status} 不可审批")
    req.status = ApprovalStatus.approved
    req.decided_by = operator.id
    req.decided_at = func.now()
    req.decision_note = note
    db.commit()
    db.refresh(req)
    _notify(f"申请 {req.request_no} 已通过,待 IT 发放")
    return req


def reject(db: Session, req_id: int, operator: User, note: str | None = None) -> ApprovalRequest:
    req = _load(db, req_id)
    if req.status != ApprovalStatus.pending:
        raise ApprovalError(f"当前状态 {req.status} 不可审批")
    req.status = ApprovalStatus.rejected
    req.decided_by = operator.id
    req.decided_at = func.now()
    req.decision_note = note
    db.commit()
    db.refresh(req)
    return req


def batch_decide(
    db: Session, ids: list[int], action: str, operator: User, note: str | None = None
) -> dict:
    """Approve/reject several pending requests at once. Non-pending or unknown
    ids are skipped (reported in `skipped`), so the call is forgiving."""
    fn = approve if action == "approve" else reject
    done, skipped = 0, 0
    for rid in ids:
        try:
            fn(db, rid, operator, note)
            done += 1
        except ApprovalError:
            skipped += 1
    return {"done": done, "skipped": skipped}


def list_all(db: Session) -> list[ApprovalRequest]:
    return list(
        db.scalars(select(ApprovalRequest).order_by(ApprovalRequest.created_at.desc())).all()
    )


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


def apply_card_decision(db: Session, approval_id, decision: str) -> bool:
    """Apply an approve/reject from a Lark interactive card.

    Shared by the HTTP webhook and the WebSocket long-connection client.
    Idempotent: returns False (no-op) for unknown or already-decided requests.
    """
    if decision not in ("approve", "reject"):
        return False
    try:
        req = db.get(ApprovalRequest, int(approval_id))
    except (TypeError, ValueError):
        return False
    if req is None or req.status != ApprovalStatus.pending:
        return False
    sys_user = db.scalar(select(User).limit(1))
    if sys_user is None:
        return False
    (approve if decision == "approve" else reject)(db, req.id, sys_user)
    return True


__all__ = [
    "ApprovalError",
    "InsufficientStock",
    "create_request",
    "approve",
    "reject",
    "fulfill",
    "apply_card_decision",
    "list_for_approver",
    "list_mine",
]
