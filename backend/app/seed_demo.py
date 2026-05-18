"""Reset + seed a clean, fake demo dataset.

Wipes all business tables then rebuilds through the service layer so codes,
lifecycle change-logs, audit rows and stock ledger are all consistent.
Run: `python -m app.seed_demo` (or `make seed`). Destructive — dev only.
All names/serials are fictional.
"""

from sqlalchemy import text

from app.db import SessionLocal, engine
from app.modules.approvals import service as appr
from app.modules.approvals.models import RequestType
from app.modules.assets import service as assets
from app.modules.assets.models import Asset, AssetClass, AssetStatus
from app.modules.inventory import service as inv
from app.modules.inventory.models import InventoryLocation, ManagementMode, Sku
from app.modules.users.models import Department, Role, User, UserStatus

_TABLES = [
    "asset_accessories", "asset_assignments", "asset_change_logs",
    "inspection_items", "inspection_tasks", "approval_requests",
    "employee_item_issues", "inventory_order_items", "inventory_orders",
    "inventory_transactions", "inventory_stocks", "skus", "item_categories",
    "inventory_locations", "audit_logs", "assets", "asset_code_counters",
    "asset_types", "users", "departments",
]


def reset() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(f"TRUNCATE {', '.join(_TABLES)} RESTART IDENTITY CASCADE")
        )


def seed() -> dict:
    db = SessionLocal()
    try:
        rnd = Department(name="研发部")
        it = Department(name="IT 部")
        db.add_all([rnd, it])
        db.flush()

        admin = User(name="演示管理员", email="admin@demo.com",
                     role=Role.it_admin, status=UserStatus.active, department_id=it.id)
        mgr = User(name="王芳", email="wangfang@demo.com",
                   role=Role.manager, status=UserStatus.active, department_id=rnd.id)
        zhang = User(name="张伟", email="zhangwei@demo.com",
                     role=Role.employee, status=UserStatus.active,
                     department_id=rnd.id)
        li = User(name="李娜", email="lina@demo.com", role=Role.employee,
                  status=UserStatus.active, department_id=rnd.id)
        db.add_all([admin, mgr, zhang, li])
        db.flush()
        zhang.manager_user_id = mgr.id
        li.manager_user_id = mgr.id
        db.commit()

        # ── inventory ────────────────────────────────────────────────
        loc = InventoryLocation(name="IT 仓库·B 区", type="warehouse")
        db.add(loc)
        db.flush()
        skus = {}
        for code, name, brand, spec, unit, mode, safety in [
            ("SKU-MS-001", "罗技 M185 鼠标", "Logitech", "无线", "个",
             ManagementMode.inventory, 10),
            ("SKU-AD-001", "USB-C 转 HDMI 转接头", "绿联", "4K@60Hz", "个",
             ManagementMode.inventory, 5),
            ("SKU-KB-001", "罗技 K380 键盘", "Logitech", "蓝牙", "个",
             ManagementMode.inventory, 5),
            ("SKU-CB-001", "CAT6 网线", "山泽", "3m", "根",
             ManagementMode.consumable, 20),
        ]:
            s = Sku(sku_code=code, name=name, brand=brand, spec=spec, unit=unit,
                    management_mode=mode, safety_stock=safety,
                    default_location_id=loc.id)
            db.add(s)
            db.flush()
            skus[code] = s.id
        db.commit()
        # stock levels: mouse LOW (3<10), others healthy
        inv.receive(db, sku_id=skus["SKU-MS-001"], quantity=3,
                    location_id=loc.id, operator_id=admin.id)
        inv.receive(db, sku_id=skus["SKU-AD-001"], quantity=24,
                    location_id=loc.id, operator_id=admin.id)
        inv.receive(db, sku_id=skus["SKU-KB-001"], quantity=12,
                    location_id=loc.id, operator_id=admin.id)
        inv.receive(db, sku_id=skus["SKU-CB-001"], quantity=45,
                    location_id=loc.id, operator_id=admin.id)

        # ── assets ───────────────────────────────────────────────────
        def mk(prefix, cls, brand_model, spec, sn, **kw):
            kw.setdefault("status", AssetStatus.idle)
            data = dict(asset_class=cls, brand_model=brand_model, spec=spec,
                        serial_number=sn, **kw)
            return assets.create_asset(db, data, prefix, admin.id)

        mac = mk("PC", AssetClass.personal, "Apple MacBook Pro 14",
                 "M3 Pro-18g-512g", "C02DEMO0001",
                 purchase_price=19999, location="上海·张江")
        assets.assign(db, mac, zhang.id, admin.id, "新员工入职配置")
        # bind an accessory (a one-code dock asset) to the MacBook
        dock = mk("PC", AssetClass.personal, "CalDigit TS4 扩展坞", "Thunderbolt",
                  "CDDEMO0001", purchase_price=2399)
        assets.bind_accessories(db, mac, [dock.id])

        mon = mk("MON", AssetClass.personal, "Dell U2723QE 27", "4K", "CNDEMO0001",
                 purchase_price=4499)
        assets.assign(db, mon, li.id, admin.id, "工位配置")

        mk("PC", AssetClass.personal, "ThinkPad X1 Carbon", "i7-16g-512g",
           "PFDEMO0002", purchase_price=12999)  # idle / in stock

        rep = mk("PC", AssetClass.personal, "ThinkPad T14", "i5-8g-256g",
                 "PFDEMO0003")
        assets.repair(db, rep, admin.id, "键盘 B 键失灵")

        old = mk("PC", AssetClass.personal, "联想 ideacentre", "已超 10 年",
                 "PCDEMO0009", scrap_candidate=True,
                 remark="已超10年,建议报废")
        assets.scrap(db, old, admin.id, "超役报废")

        mk("NET", AssetClass.infrastructure, "锐捷 EAP262 AP", None,
           "RJDEMO0001", location="3F 弱电间", status=AssetStatus.in_use)

        mk("PC", AssetClass.personal, "戴尔灵越", "i5-8g-256g", "无",
           owner_name="实习生", needs_review=True,
           remark="使用人待匹配")

        # ── a pending approval from 张伟 ──────────────────────────────
        appr.create_request(
            db, requester=zhang, request_type=RequestType.consumable,
            payload={"items": [{"sku_id": skus["SKU-AD-001"], "qty": 1}],
                     "reason": "会议室投屏需要转接头", "urgency": "normal",
                     "deliver_to": "self_desk"},
        )

        return {
            "users": db.query(User).count(),
            "assets": db.query(Asset).count(),
            "skus": db.query(Sku).count(),
        }
    finally:
        db.close()


def main() -> None:
    reset()
    print("reset done; seeding…")
    print("seeded:", seed())


if __name__ == "__main__":
    main()
