from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.modules.approvals.models import ApprovalStatus, RequestType


class RequestItem(BaseModel):
    sku_id: int
    qty: int


class CreateRequestIn(BaseModel):
    request_type: RequestType
    items: list[RequestItem] = []
    reason: str
    urgency: str = "normal"
    deliver_to: str = "self_desk"


class DecisionIn(BaseModel):
    note: str | None = None


class BatchDecisionIn(BaseModel):
    ids: list[int]
    action: Literal["approve", "reject"]
    note: str | None = None


class ApprovalItemOut(BaseModel):
    sku_id: int
    sku_code: str | None = None
    name: str | None = None
    spec: str | None = None
    unit: str | None = None
    qty: int


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_no: str
    request_type: RequestType
    requester_id: int
    requester_name: str | None = None
    approver_id: int | None
    approver_name: str | None = None  # who decided
    status: ApprovalStatus
    payload_json: dict
    items: list[ApprovalItemOut] = []  # enriched from payload + SKU directory
    decision_note: str | None = None
    decided_at: datetime | None = None
    created_at: datetime
