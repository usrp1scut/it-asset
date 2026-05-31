from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.offboarding.models import (
    ItemCondition,
    OffboardingItemStatus,
    OffboardingStatus,
)


class CaseCreate(BaseModel):
    user_id: int
    last_day: date | None = None
    reason: str | None = None


class ItemReturnIn(BaseModel):
    condition: ItemCondition = ItemCondition.good
    remark: str | None = None


class ItemLostIn(BaseModel):
    remark: str | None = None


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_code: str
    brand_model: str | None
    snapshot_value: Decimal | None
    status: OffboardingItemStatus
    condition: ItemCondition | None
    returned_at: datetime | None
    remark: str | None


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_no: str
    user_id: int
    user_name: str | None
    department_name: str | None
    last_day: date | None
    reason: str | None
    hr_channel: str
    status: OffboardingStatus
    completed_at: datetime | None
    created_at: datetime
    # value/progress summary (filled by the router)
    total_items: int = 0
    returned_items: int = 0
    lost_items: int = 0
    pending_items: int = 0
    total_value: Decimal = Decimal(0)
    pending_value: Decimal = Decimal(0)


class CaseDetail(CaseOut):
    items: list[ItemOut] = []
