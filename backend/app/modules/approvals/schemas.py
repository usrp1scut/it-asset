from datetime import datetime

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


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_no: str
    request_type: RequestType
    requester_id: int
    approver_id: int | None
    status: ApprovalStatus
    payload_json: dict
    created_at: datetime
