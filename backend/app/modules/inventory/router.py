from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.inventory import service
from app.modules.inventory.models import (
    InventoryLocation,
    InventoryStock,
    InventoryTransaction,
    Sku,
)
from app.modules.inventory.schemas import (
    IssueIn,
    LocationIn,
    LocationOut,
    OrderOut,
    ReceiveIn,
    ReturnIn,
    SkuCreate,
    SkuListResponse,
    SkuOut,
    SkuUpdate,
    StockOut,
    TxnOut,
)
from app.modules.users.models import Role, User

router = APIRouter(tags=["inventory"])

staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)
it_admin = require_roles(Role.it_admin, Role.procurement)


def _level(available: int, safety: int) -> str:
    if safety <= 0:
        return "normal"
    if available <= safety:
        return "low"
    if available <= safety * 1.5:
        return "warn"
    return "normal"


def _sku_out(db: Session, sku: Sku) -> SkuOut:
    avail = service.total_available(db, sku.id)
    o = SkuOut.model_validate(sku)
    o.available = avail
    o.level = _level(avail, sku.safety_stock)
    return o


# ── SKU ──────────────────────────────────────────────────────────────────────


@router.get("/api/skus", response_model=SkuListResponse)
def list_skus(
    db: Session = Depends(get_db),
    _: User = Depends(staff),
    mode: str | None = None,
    warning_only: bool = False,
    q: str | None = None,
):
    stmt = select(Sku)
    if mode:
        stmt = stmt.where(Sku.management_mode == mode)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Sku.name.ilike(like) | Sku.sku_code.ilike(like))
    skus = db.scalars(stmt.order_by(Sku.id.desc())).all()
    items = [_sku_out(db, s) for s in skus]
    if warning_only:
        items = [i for i in items if i.level != "normal"]
    return SkuListResponse(total=len(items), items=items)


@router.post("/api/skus", response_model=SkuOut, status_code=status.HTTP_201_CREATED)
def create_sku(body: SkuCreate, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    if db.scalar(select(Sku).where(Sku.sku_code == body.sku_code)):
        raise HTTPException(status.HTTP_409_CONFLICT, "SKU 编码已存在")
    sku = Sku(**body.model_dump())
    db.add(sku)
    db.commit()
    db.refresh(sku)
    write_audit(db, actor_user_id=user.id, action="sku.create",
                resource_type="sku", resource_id=sku.sku_code)
    return _sku_out(db, sku)


@router.put("/api/skus/{sku_code}", response_model=SkuOut)
def update_sku(
    sku_code: str, body: SkuUpdate, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    sku = db.scalar(select(Sku).where(Sku.sku_code == sku_code))
    if sku is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "SKU 不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(sku, k, v)
    db.commit()
    db.refresh(sku)
    return _sku_out(db, sku)


@router.get("/api/skus/{sku_code}/transactions", response_model=list[TxnOut])
def sku_transactions(sku_code: str, db: Session = Depends(get_db), _: User = Depends(staff)):
    sku = db.scalar(select(Sku).where(Sku.sku_code == sku_code))
    if sku is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "SKU 不存在")
    rows = db.scalars(
        select(InventoryTransaction)
        .where(InventoryTransaction.sku_id == sku.id)
        .order_by(InventoryTransaction.created_at.desc())
    ).all()
    return [TxnOut.model_validate(r) for r in rows]


# ── Locations ────────────────────────────────────────────────────────────────


@router.get("/api/inventory/locations", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db), _: User = Depends(staff)):
    return [LocationOut.model_validate(x) for x in db.scalars(select(InventoryLocation))]


@router.post("/api/inventory/locations", response_model=LocationOut,
             status_code=status.HTTP_201_CREATED)
def create_location(body: LocationIn, db: Session = Depends(get_db), _: User = Depends(it_admin)):
    loc = InventoryLocation(**body.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return LocationOut.model_validate(loc)


# ── Stock movements ──────────────────────────────────────────────────────────


@router.post("/api/inventory/receive", response_model=OrderOut)
def receive(body: ReceiveIn, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    try:
        order = service.receive(
            db, sku_id=body.sku_id, quantity=body.quantity, location_id=body.location_id,
            operator_id=user.id, unit_price=body.unit_price, manual=body.manual,
            remark=body.remark,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return OrderOut.model_validate(order)


@router.post("/api/inventory/issue", response_model=OrderOut)
def issue(body: IssueIn, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    try:
        order = service.issue(
            db, sku_id=body.sku_id, quantity=body.quantity, user_id=body.user_id,
            location_id=body.location_id, operator_id=user.id, remark=body.remark,
        )
    except service.InsufficientStock as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return OrderOut.model_validate(order)


@router.post("/api/inventory/return", response_model=OrderOut)
def return_stock(body: ReturnIn, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    try:
        order = service.return_stock(
            db, sku_id=body.sku_id, quantity=body.quantity, location_id=body.location_id,
            operator_id=user.id, remark=body.remark,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return OrderOut.model_validate(order)


@router.get("/api/inventory/stocks", response_model=list[StockOut])
def stocks(
    db: Session = Depends(get_db),
    _: User = Depends(staff),
    sku_id: int | None = Query(None),
):
    stmt = select(InventoryStock)
    if sku_id:
        stmt = stmt.where(InventoryStock.sku_id == sku_id)
    return [StockOut.model_validate(s) for s in db.scalars(stmt)]
