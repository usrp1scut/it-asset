from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.approvals.models import ApprovalRequest, ApprovalStatus
from app.modules.assets.models import Asset, AssetChangeLog, AssetStatus
from app.modules.inventory.service import low_stock_skus
from app.modules.users.models import Department

_TREND_ACTIONS = ("assign", "return", "repair")


def _alive():
    return Asset.deleted_at.is_(None)


def overview(db: Session) -> dict:
    total = db.scalar(select(func.count()).select_from(Asset).where(_alive())) or 0

    by_status = dict(
        db.execute(
            select(Asset.status, func.count())
            .where(_alive())
            .group_by(Asset.status)
        ).all()
    )
    counts = {s.value: int(by_status.get(s, 0)) for s in AssetStatus}

    total_value = db.scalar(
        select(func.coalesce(func.sum(Asset.purchase_price), 0)).where(
            _alive(), Asset.status != AssetStatus.scrapped
        )
    ) or 0

    needs_review = db.scalar(
        select(func.count()).select_from(Asset).where(_alive(), Asset.needs_review.is_(True))
    ) or 0
    scrap_candidate = db.scalar(
        select(func.count()).select_from(Asset).where(_alive(), Asset.scrap_candidate.is_(True))
    ) or 0

    low = low_stock_skus(db)

    pending_approvals = db.scalar(
        select(func.count())
        .select_from(ApprovalRequest)
        .where(ApprovalRequest.status.in_([ApprovalStatus.pending, ApprovalStatus.approved]))
    ) or 0
    recent_approvals = [
        {
            "request_no": r.request_no,
            "request_type": r.request_type.value,
            "requester_id": r.requester_id,
            "status": r.status.value,
            "created_at": r.created_at.isoformat(),
        }
        for r in db.scalars(
            select(ApprovalRequest)
            .order_by(ApprovalRequest.created_at.desc())
            .limit(8)
        )
    ]

    # Department distribution (top 8 by count)
    dept_rows = db.execute(
        select(Asset.department_id, func.count())
        .where(_alive(), Asset.department_id.isnot(None))
        .group_by(Asset.department_id)
        .order_by(func.count().desc())
        .limit(8)
    ).all()
    dept_names = dict(
        db.execute(
            select(Department.id, Department.name).where(
                Department.id.in_([d for d, _ in dept_rows] or [0])
            )
        ).all()
    )
    dept_distribution = [
        {"department_id": d, "name": dept_names.get(d, f"#{d}"), "count": int(c)}
        for d, c in dept_rows
    ]

    # 12-week trends from change logs
    since = datetime.now(UTC) - timedelta(weeks=12)
    logs = db.execute(
        select(AssetChangeLog.action, AssetChangeLog.created_at).where(
            AssetChangeLog.created_at >= since,
            AssetChangeLog.action.in_(_TREND_ACTIONS),
        )
    ).all()
    bins = {a: [0] * 12 for a in _TREND_ACTIONS}
    now = datetime.now(UTC)
    for action, ts in logs:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        idx = 11 - min(11, (now - ts).days // 7)
        if 0 <= idx < 12:
            bins[action][idx] += 1
    trends = {"assignment": bins["assign"], "return": bins["return"], "repair": bins["repair"]}

    recent = db.execute(
        select(
            AssetChangeLog.action,
            AssetChangeLog.to_status,
            AssetChangeLog.created_at,
            Asset.asset_code,
            Asset.brand_model,
        )
        .join(Asset, Asset.id == AssetChangeLog.asset_id)
        .order_by(AssetChangeLog.created_at.desc())
        .limit(10)
    ).all()
    recent_assignments = [
        {
            "action": a,
            "to_status": ts,
            "created_at": dt.isoformat(),
            "asset_code": code,
            "brand_model": bm,
        }
        for a, ts, dt, code, bm in recent
    ]

    return {
        "stats": {
            "total_assets": total,
            "total_value": float(total_value),
            "pending_approvals": int(pending_approvals),
            "low_stock_count": len(low),
            "in_use_count": counts["in_use"],
            "idle_count": counts["idle"],
            "maintenance_count": counts["maintenance"],
            "scrapped_count": counts["scrapped"],
            "needs_review_count": int(needs_review),
            "scrap_candidate_count": int(scrap_candidate),
        },
        "status_distribution": [
            {"status": k, "count": v} for k, v in counts.items()
        ],
        "trends": trends,
        "dept_distribution": dept_distribution,
        "low_stock_skus": [
            {"sku_code": s.sku_code, "name": s.name, "available": a, "safety": s.safety_stock}
            for s, a in low[:8]
        ],
        "recent_assignments": recent_assignments,
        "recent_approvals": recent_approvals,
    }
