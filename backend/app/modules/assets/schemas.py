from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.assets.models import AssetClass, AssetStatus


class AttachmentOut(BaseModel):
    key: str
    name: str
    content_type: str
    size: int
    uploaded_at: str


class AssetCreate(BaseModel):
    asset_class: AssetClass
    asset_type_id: int | None = None
    prefix: str  # 编号前缀 PC/MON/NET(asset_code 留空时按此生成)
    asset_code: str | None = None
    brand_model: str | None = None
    spec: str | None = None
    serial_number: str | None = None
    legacy_code: str | None = None
    owner_user_id: int | None = None
    owner_name: str | None = None
    department_id: int | None = None
    department_name: str | None = None
    location: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    warranty_expire_date: date | None = None
    supplier: str | None = None
    remark: str | None = None
    scrap_candidate: bool = False
    needs_review: bool = False


class AssetUpdate(BaseModel):
    brand_model: str | None = None
    spec: str | None = None
    serial_number: str | None = None
    owner_name: str | None = None
    department_id: int | None = None
    department_name: str | None = None
    location: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    warranty_expire_date: date | None = None
    supplier: str | None = None
    remark: str | None = None
    scrap_candidate: bool | None = None
    needs_review: bool | None = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_code: str
    asset_class: AssetClass
    asset_type_id: int | None
    brand_model: str | None
    spec: str | None
    serial_number: str | None
    legacy_code: str | None
    status: AssetStatus
    owner_user_id: int | None
    owner_name: str | None
    department_id: int | None
    department_name: str | None
    location: str | None
    purchase_date: date | None
    purchase_price: Decimal | None
    warranty_expire_date: date | None
    supplier: str | None
    remark: str | None
    scrap_candidate: bool
    needs_review: bool


class AssetListResponse(BaseModel):
    total: int
    items: list[AssetOut]


class ChangeLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    action: str
    from_status: str | None
    to_status: str | None
    operator_id: int | None
    reason: str | None
    created_at: datetime


class AccessoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_accessory_id: int | None
    sku_id: int | None
    quantity: int
    binding_type: str
    need_return: bool


class AssetDetailOut(BaseModel):
    asset: AssetOut
    lifecycle: list[ChangeLogOut]
    accessories: list[AccessoryOut]


class AssignIn(BaseModel):
    user_id: int
    note: str | None = None


class ReasonIn(BaseModel):
    reason: str | None = None


class NoteIn(BaseModel):
    note: str | None = None


class TransferIn(BaseModel):
    to_user_id: int
    reason: str | None = None


class BindAccessoriesIn(BaseModel):
    child_ids: list[int]
