"""报废处置工作流(Phase 2):申请→审批→处置→资产 scrapped。

资产状态在 disposed 阶段才真正翻 scrapped(复用既有 service.scrap)。
之前都停在原态;`Asset.scrap_candidate=True` 仅作"进行中"标识。
"""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.assets import service
from app.modules.assets.models import (
    Asset,
    AssetStatus,
    DispositionMethod,
    ScrapRequest,
    ScrapRequestStatus,
)


class IllegalScrapTransition(Exception):
    pass


def submit_request(
    db: Session, asset: Asset, proposer_id: int, reason: str
) -> ScrapRequest:
    if asset.status == AssetStatus.scrapped:
        raise IllegalScrapTransition("资产已报废")
    open_states = (ScrapRequestStatus.pending, ScrapRequestStatus.approved)
    existing = db.scalar(
        select(ScrapRequest).where(
            ScrapRequest.asset_id == asset.id,
            ScrapRequest.status.in_(open_states),
        )
    )
    if existing is not None:
        raise IllegalScrapTransition("已有进行中的报废申请")
    req = ScrapRequest(
        asset_id=asset.id, proposer_id=proposer_id, reason=reason.strip(),
        status=ScrapRequestStatus.pending,
    )
    db.add(req)
    asset.scrap_candidate = True
    db.commit()
    db.refresh(req)
    return req


def approve(
    db: Session, req: ScrapRequest, approver_id: int, remark: str | None
) -> ScrapRequest:
    if req.status != ScrapRequestStatus.pending:
        raise IllegalScrapTransition("仅 pending 状态可审批")
    if req.proposer_id == approver_id:
        raise IllegalScrapTransition("不能审批自己提交的申请;请另一位管理员处理")
    req.status = ScrapRequestStatus.approved
    req.approver_id = approver_id
    req.approved_at = datetime.now(UTC)
    req.approve_remark = remark
    db.commit()
    db.refresh(req)
    return req


def reject(
    db: Session, req: ScrapRequest, approver_id: int, remark: str
) -> ScrapRequest:
    if req.status != ScrapRequestStatus.pending:
        raise IllegalScrapTransition("仅 pending 状态可拒绝")
    if req.proposer_id == approver_id:
        raise IllegalScrapTransition("不能审批自己提交的申请;请另一位管理员处理")
    if not (remark or "").strip():
        raise IllegalScrapTransition("拒绝必须填写原因")
    req.status = ScrapRequestStatus.rejected
    req.approver_id = approver_id
    req.approved_at = datetime.now(UTC)
    req.approve_remark = remark
    asset = db.get(Asset, req.asset_id)
    if asset is not None:
        # Other open requests don't exist (submit guards against it); flip flag off.
        asset.scrap_candidate = False
    db.commit()
    db.refresh(req)
    return req


def dispose(
    db: Session,
    req: ScrapRequest,
    operator_id: int,
    method: DispositionMethod,
    residual_value: Decimal | None,
    remark: str | None,
) -> ScrapRequest:
    if req.status != ScrapRequestStatus.approved:
        raise IllegalScrapTransition("仅 approved 状态可处置;请先审批")
    asset = db.get(Asset, req.asset_id)
    if asset is None:
        raise IllegalScrapTransition("资产已不存在")
    req.disposition_method = method
    req.residual_value = residual_value
    req.disposed_by = operator_id
    req.disposed_at = datetime.now(UTC)
    req.disposal_remark = remark
    req.status = ScrapRequestStatus.disposed
    db.commit()
    # service.scrap flips asset.status=scrapped, clears owner, writes change-log + audit
    service.scrap(db, asset, operator_id, f"报废处置 · {method.value} · {remark or ''}")
    db.refresh(req)
    return req
