from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.inventory.models import ManagementMode


class ItemCategoryCreate(BaseModel):
    name: str
    code: str
    management_mode: ManagementMode = ManagementMode.inventory


class ItemCategoryUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class ItemCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    management_mode: ManagementMode
    sku_count: int = 0


class SkuCreate(BaseModel):
    # sku_code is server-generated from the category code (<code>-001 …).
    category_id: int
    name: str
    brand: str | None = None
    spec: str | None = None
    unit: str = "个"
    management_mode: ManagementMode = ManagementMode.inventory
    need_approval: bool = False
    need_return: bool = False
    safety_stock: int = 0
    max_stock: int | None = None
    monthly_use: int | None = None
    default_location_id: int | None = None
    price: Decimal | None = None


class SkuUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    spec: str | None = None
    safety_stock: int | None = None
    max_stock: int | None = None
    monthly_use: int | None = None
    default_location_id: int | None = None
    price: Decimal | None = None
    status: str | None = None


class SkuOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku_code: str
    name: str
    category_id: int | None
    category_name: str | None = None
    category_code: str | None = None
    brand: str | None
    spec: str | None
    unit: str
    management_mode: ManagementMode
    safety_stock: int
    max_stock: int | None
    monthly_use: int | None
    price: Decimal | None
    # computed
    available: int = 0
    level: str = "normal"  # normal | warn | low


class SkuListResponse(BaseModel):
    total: int
    items: list[SkuOut]


class LocationIn(BaseModel):
    name: str
    type: str | None = None
    address: str | None = None


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str | None
    address: str | None


class ReceiveIn(BaseModel):
    sku_id: int
    quantity: int
    location_id: int | None = None
    unit_price: Decimal | None = None
    manual: bool = False
    remark: str | None = None


class IssueIn(BaseModel):
    sku_id: int
    quantity: int
    user_id: int
    location_id: int | None = None
    remark: str | None = None


class ReturnIn(BaseModel):
    sku_id: int
    quantity: int
    location_id: int | None = None
    remark: str | None = None


class AdjustIn(BaseModel):
    """Manual stock correction — set a location's balance to target_quantity."""

    sku_id: int
    target_quantity: int
    location_id: int | None = None
    remark: str | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_no: str
    order_type: str
    status: str


class TxnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_type: str
    quantity: int
    before_quantity: int
    after_quantity: int
    operator_id: int | None
    created_at: datetime


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku_id: int
    location_id: int
    quantity_available: int
    quantity_locked: int
    quantity_damaged: int
