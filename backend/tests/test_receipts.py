import uuid

from app.db import SessionLocal
from app.lark import receipts
from app.lark.cards import receipt_card
from app.modules.inventory.models import (
    EmployeeItemIssue,
    ItemCategory,
    ManagementMode,
    Sku,
)
from app.modules.users.models import Role, User


def _mk_issue(db) -> EmployeeItemIssue:
    u = User(name="领用人", role=Role.employee)
    cat = ItemCategory(
        name="测试", code=f"T{uuid.uuid4().hex[:6].upper()}",
        management_mode=ManagementMode.inventory,
    )
    db.add_all([u, cat])
    db.flush()
    sku = Sku(sku_code=f"T-{uuid.uuid4().hex[:8]}", name="测试物品", category_id=cat.id)
    db.add(sku)
    db.flush()
    rec = EmployeeItemIssue(user_id=u.id, sku_id=sku.id, quantity=2, need_return=False)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def test_receipt_card_button_vs_confirmed():
    unc = receipt_card(title="资产领用确认", lines=["a"], ack_value={"ack": "asset", "id": 1})
    # un-acknowledged → has a 确认收到 button carrying the ack value
    btns = [e for e in unc["elements"] if e.get("tag") == "action"]
    assert btns and btns[0]["actions"][0]["value"] == {"ack": "asset", "id": 1}
    assert unc["header"]["template"] == "blue"

    ack = receipt_card(
        title="x", lines=["a"], ack_value={"ack": "asset", "id": 1},
        acknowledged=True, ack_time="2026-06-26 10:00",
    )
    assert not any(e.get("tag") == "action" for e in ack["elements"])  # no button
    assert ack["header"]["template"] == "green"
    assert any("已确认领取" in e.get("text", {}).get("content", "") for e in ack["elements"])


def test_confirm_receipt_idempotent_and_guarded():
    db = SessionLocal()
    try:
        rec = _mk_issue(db)
        assert rec.acknowledged_at is None
        # first tap → newly recorded + acknowledged (green) card echoed back
        newly, card = receipts.confirm_receipt(db, kind="issue", record_id=rec.id)
        assert newly is True
        assert card is not None and card["header"]["template"] == "green"
        assert not any(e.get("tag") == "action" for e in card["elements"])  # button gone
        db.refresh(rec)
        assert rec.acknowledged_at is not None
        # second tap → not newly recorded, but still yields the acknowledged card
        newly2, card2 = receipts.confirm_receipt(db, kind="issue", record_id=rec.id)
        assert newly2 is False
        assert card2 is not None and card2["header"]["template"] == "green"
        # missing record / bad kind → (False, None)
        assert receipts.confirm_receipt(db, kind="issue", record_id=999999999) == (False, None)
        assert receipts.confirm_receipt(db, kind="bogus", record_id=rec.id) == (False, None)
    finally:
        db.close()


def test_send_receipt_noop_safe():
    # Lark unconfigured (or unreachable) in tests → send_receipt never raises and
    # leaves receipt_msg_id unset; the business flow is unaffected.
    db = SessionLocal()
    try:
        rec = _mk_issue(db)
        receipts.send_receipt(db, kind="issue", record_id=rec.id, open_id="ou-test")
        db.refresh(rec)
        assert rec.receipt_msg_id is None
    finally:
        db.close()
