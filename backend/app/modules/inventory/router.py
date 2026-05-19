from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.inventory import service
from app.modules.inventory.models import (
    InventoryLocation,
    InventoryStock,
    InventoryTransaction,
    ItemCategory,
    Sku,
)
from app.modules.inventory.schemas import (
    IssueIn,
    ItemCategoryCreate,
    ItemCategoryOut,
    ItemCategoryUpdate,
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


def _sku_out(db: Session, sku: Sku, cat: ItemCategory | None = None) -> SkuOut:
    avail = service.total_available(db, sku.id)
    o = SkuOut.model_validate(sku)
    o.available = avail
    o.level = _level(avail, sku.safety_stock)
    if cat is None and sku.category_id is not None:
        cat = db.get(ItemCategory, sku.category_id)
    if cat is not None:
        o.category_name = cat.name
        o.category_code = cat.code
    return o


# ── Categories ───────────────────────────────────────────────────────────────


@router.get("/api/item-categories", response_model=list[ItemCategoryOut])
def list_categories(db: Session = Depends(get_db), _: User = Depends(staff)):
    cats = db.scalars(select(ItemCategory).order_by(ItemCategory.code)).all()
    out: list[ItemCategoryOut] = []
    for c in cats:
        o = ItemCategoryOut.model_validate(c)
        o.sku_count = db.scalar(
            select(func.count()).select_from(Sku).where(Sku.category_id == c.id)
        ) or 0
        out.append(o)
    return out


@router.post("/api/item-categories", response_model=ItemCategoryOut,
             status_code=status.HTTP_201_CREATED)
def create_category(
    body: ItemCategoryCreate, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    code = body.code.strip().upper()
    if not code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "分类简码不能为空")
    if db.scalar(select(ItemCategory).where(ItemCategory.code == code)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"简码 {code} 已被占用")
    cat = ItemCategory(name=body.name, code=code, management_mode=body.management_mode)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    write_audit(db, actor_user_id=user.id, action="category.create",
                resource_type="item_category", resource_id=code)
    return ItemCategoryOut.model_validate(cat)


@router.put("/api/item-categories/{cat_id}", response_model=ItemCategoryOut)
def update_category(
    cat_id: int, body: ItemCategoryUpdate, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    cat = db.get(ItemCategory, cat_id)
    if cat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分类不存在")
    if body.name is not None:
        cat.name = body.name
    if body.code is not None:
        code = body.code.strip().upper()
        if not code:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "分类简码不能为空")
        if code != cat.code and db.scalar(
            select(ItemCategory).where(ItemCategory.code == code)
        ):
            raise HTTPException(status.HTTP_409_CONFLICT, f"简码 {code} 已被占用")
        cat.code = code
    db.commit()
    db.refresh(cat)
    write_audit(db, actor_user_id=user.id, action="category.update",
                resource_type="item_category", resource_id=cat.code)
    return ItemCategoryOut.model_validate(cat)


# ── SKU ──────────────────────────────────────────────────────────────────────


@router.get("/api/skus", response_model=SkuListResponse)
def list_skus(
    db: Session = Depends(get_db),
    _: User = Depends(staff),
    mode: str | None = None,
    warning_only: bool = False,
    category_id: int | None = None,
    q: str | None = None,
):
    stmt = select(Sku)
    if mode:
        stmt = stmt.where(Sku.management_mode == mode)
    if category_id:
        stmt = stmt.where(Sku.category_id == category_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Sku.name.ilike(like) | Sku.sku_code.ilike(like))
    skus = db.scalars(stmt.order_by(Sku.id.desc())).all()
    cats = {c.id: c for c in db.scalars(select(ItemCategory))}
    items = [_sku_out(db, s, cats.get(s.category_id)) for s in skus]
    if warning_only:
        items = [i for i in items if i.level != "normal"]
    return SkuListResponse(total=len(items), items=items)


@router.post("/api/skus", response_model=SkuOut, status_code=status.HTTP_201_CREATED)
def create_sku(body: SkuCreate, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    cat = db.get(ItemCategory, body.category_id)
    if cat is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "分类不存在")
    sku = Sku(**body.model_dump())
    sku.sku_code = service.generate_sku_code(db, cat.code)
    db.add(sku)
    db.commit()
    db.refresh(sku)
    write_audit(db, actor_user_id=user.id, action="sku.create",
                resource_type="sku", resource_id=sku.sku_code)
    return _sku_out(db, sku, cat)


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
