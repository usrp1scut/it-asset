from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.assets.models import (
    AssetClass,
    AssetStatus,
    DispositionMethod,
    RepairOrderStatus,
    RepairType,
    ScrapRequestStatus,
)


class ScrapRequestSubmitIn(BaseModel):
    reason: str


class ScrapRequestApproveIn(BaseModel):
    remark: str | None = None


class ScrapRequestRejectIn(BaseModel):
    remark: str


class ScrapRequestDisposeIn(BaseModel):
    disposition_method: DispositionMethod
    residual_value: Decimal | None = None
    remark: str | None = None


class ScrapRequestOut(BaseModel):
    id: int
    asset_id: int
    asset_code: str
    brand_model: str | None
    proposer_id: int
    proposer_name: str | None
    reason: str
    status: ScrapRequestStatus
    approver_id: int | None
    approver_name: str | None
    approved_at: datetime | None
    approve_remark: str | None
    disposition_method: DispositionMethod | None
    residual_value: Decimal | None
    disposed_by: int | None
    disposed_at: datetime | None
    disposal_remark: str | None
    created_at: datetime


class RepairOpenIn(BaseModel):
    reason: str
    repair_type: RepairType = RepairType.in_house
    vendor: str | None = None
    shipped_at: date | None = None
    expected_return_at: date | None = None
    note: str | None = None


class RepairUpdateIn(BaseModel):
    vendor: str | None = None
    shipped_at: date | None = None
    expected_return_at: date | None = None
    note: str | None = None


class RepairCompleteIn(BaseModel):
    cost: Decimal | None = None
    warranty_covered: bool = False
    warranty_until: date | None = None
    resolution: str


class RepairCancelIn(BaseModel):
    reason: str


class RepairOrderOut(BaseModel):
    id: int
    asset_id: int
    asset_code: str
    brand_model: str | None
    opened_by: int
    opened_by_name: str | None
    reason: str
    repair_type: RepairType
    vendor: str | None
    shipped_at: date | None
    expected_return_at: date | None
    status: RepairOrderStatus
    cost: Decimal | None
    warranty_covered: bool
    warranty_until: date | None
    resolution: str | None
    notes: str | None
    closed_by: int | None
    closed_at: datetime | None
    created_at: datetime


class AttachmentOut(BaseModel):
    key: str
    name: str
    content_type: str
    size: int
    uploaded_at: str


class AssetTypeCreate(BaseModel):
    name: str
    code_prefix: str
    asset_class: AssetClass
    depreciation_years: int | None = None
    icon: str | None = None
    color: str | None = None


class AssetTypeUpdate(BaseModel):
    name: str | None = None
    code_prefix: str | None = None
    asset_class: AssetClass | None = None
    depreciation_years: int | None = None
    icon: str | None = None
    color: str | None = None


class AssetTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code_prefix: str
    asset_class: AssetClass
    depreciation_years: int | None = None
    icon: str | None = None
    color: str | None = None
    asset_count: int = 0


class ChangeTypeIn(BaseModel):
    asset_type_id: int


class SetStatusIn(BaseModel):
    status: AssetStatus
    note: str | None = None


class AssetCreate(BaseModel):
    # Either asset_type_id (preferred — drives prefix + asset_class) or the
    # legacy pair (asset_class + prefix) must be supplied.
    asset_type_id: int | None = None
    asset_class: AssetClass | None = None
    prefix: str | None = None  # 编号前缀 PC/MON/NET(asset_code 留空时按此生成)
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
    asset_type_name: str | None = None
    asset_type_icon: str | None = None
    asset_type_color: str | None = None
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
    # Current holder's 领用确认 state: "" (no card sent) | "pending" | "acknowledged"
    receipt_state: str = ""
    receipt_ack_at: datetime | None = None


class AssignIn(BaseModel):
    user_id: int
    note: str | None = None
    notify_receipt: bool = False  # send a Lark 领用确认 card to the employee


class ReasonIn(BaseModel):
    reason: str | None = None


class NoteIn(BaseModel):
    note: str | None = None


class TransferIn(BaseModel):
    to_user_id: int
    reason: str | None = None


class BindAccessoriesIn(BaseModel):
    child_ids: list[int]
