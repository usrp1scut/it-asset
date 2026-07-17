"""座位图 service.

落座 = 把工位的展示名回写到 `Asset.location`(派生冗余,兼容既有台账/导出/筛选)
并记一条 relocate 生命周期。撤离/删除工位/删除图都会把相关资产的 location 清回,
同样留痕。所有写位置的动作都经 `_relocate`,保证台账与工位单一出口。
"""
from itertools import groupby

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.modules.assets.models import Asset, AssetChangeLog, AssetClass, AssetStatus
from app.modules.seatmap.models import FloorMap, MapLabel, Seat
from app.modules.users.models import Department, User, UserStatus

MAX_DIM = 40           # 画布行/列上限
_SHIFT_PARK = 1000     # 整体平移时的临时停车区(见 _shift)


class SeatMapError(ValueError):
    pass


def _label(m: FloorMap, seat: Seat) -> str:
    tail = seat.seat_no or f"R{seat.row + 1}C{seat.col + 1}"
    return f"{m.name}-{tail}"


def _relocate(
    db: Session, asset: Asset, seat: Seat | None, m: FloorMap, operator_id: int | None
) -> None:
    """Single writer for an asset's physical position: seat_id + derived location
    + a relocate change-log entry (empty seat = moved off the map)."""
    asset.seat_id = seat.id if seat else None
    asset.location = _label(m, seat) if seat else None
    db.add(
        AssetChangeLog(
            asset_id=asset.id,
            action="relocate",
            operator_id=operator_id,
            reason=(f"工位 {asset.location}" if asset.location else "移出工位"),
        )
    )


# ── maps ──────────────────────────────────────────────────────────────────────


def list_maps(db: Session) -> list[FloorMap]:
    return list(db.scalars(select(FloorMap).order_by(FloorMap.id)))


def create_map(db: Session, *, name: str, rows: int, cols: int, created_by: int | None) -> FloorMap:
    m = FloorMap(
        name=(name or "").strip() or "未命名",
        rows=max(1, min(rows, 40)),
        cols=max(1, min(cols, 40)),
        created_by=created_by,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def get_map(db: Session, map_id: int) -> FloorMap | None:
    return db.get(FloorMap, map_id)


def seats_of(db: Session, map_id: int) -> list[Seat]:
    return list(
        db.scalars(select(Seat).where(Seat.map_id == map_id).order_by(Seat.row, Seat.col))
    )


def _assets_on(db: Session, seat_ids: list[int]) -> dict[int, list[Asset]]:
    out: dict[int, list[Asset]] = {}
    if not seat_ids:
        return out
    for a in db.scalars(
        select(Asset).where(Asset.seat_id.in_(seat_ids), Asset.deleted_at.is_(None))
    ):
        out.setdefault(a.seat_id, []).append(a)
    return out


def labels_of(db: Session, map_id: int) -> list[MapLabel]:
    return list(
        db.scalars(
            select(MapLabel).where(MapLabel.map_id == map_id).order_by(MapLabel.row, MapLabel.col)
        )
    )


def map_payload(db: Session, m: FloorMap) -> dict:
    """Assemble the map + enriched seats (occupant name + placed assets) + labels."""
    seats = seats_of(db, m.id)
    on = _assets_on(db, [s.id for s in seats])
    uids = {s.user_id for s in seats if s.user_id}
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(uids or [0])))}
    return {
        "map": m,
        "labels": [
            {"id": lb.id, "row": lb.row, "col": lb.col, "text": lb.text}
            for lb in labels_of(db, m.id)
        ],
        "seats": [
            {
                "id": s.id,
                "row": s.row,
                "col": s.col,
                "seat_no": s.seat_no,
                "zone": s.zone,
                "user_id": s.user_id,
                "user_name": names.get(s.user_id),
                "assets": [
                    {"id": a.id, "asset_code": a.asset_code, "name": a.brand_model}
                    for a in on.get(s.id, [])
                ],
            }
            for s in seats
        ],
    }


def delete_map(db: Session, m: FloorMap) -> None:
    seats = seats_of(db, m.id)
    ids = [s.id for s in seats]
    if ids:
        for a in db.scalars(select(Asset).where(Asset.seat_id.in_(ids))):
            _relocate(db, a, None, m, operator_id=None)
        db.execute(delete(Seat).where(Seat.map_id == m.id))
    db.execute(delete(MapLabel).where(MapLabel.map_id == m.id))
    db.delete(m)
    db.commit()


# ── layout / numbering ────────────────────────────────────────────────────────


def set_layout(db: Session, m: FloorMap, cells: list, labels: list | None = None) -> None:
    """Replace the set of seat cells (add new, update zone, remove absent) and
    the set of position labels (窗/柜子/机房…) in one save.

    Removing a seat first moves any assets on it off the map. A cell is either a
    seat or a label — never both.
    """
    in_bounds = lambda r, c: 0 <= r < m.rows and 0 <= c < m.cols  # noqa: E731
    incoming = {(c.row, c.col): c for c in cells if in_bounds(c.row, c.col)}
    incoming_labels = {
        (lb.row, lb.col): lb
        for lb in (labels or [])
        if in_bounds(lb.row, lb.col) and (lb.text or "").strip()
    }
    clash = set(incoming) & set(incoming_labels)
    if clash:
        raise SeatMapError("同一格子不能既是工位又是备注")

    existing = {(s.row, s.col): s for s in seats_of(db, m.id)}
    for (r, c), cell in incoming.items():
        s = existing.get((r, c))
        if s:
            s.zone = cell.zone
        else:
            db.add(Seat(map_id=m.id, row=r, col=c, zone=cell.zone))
    for (r, c), s in existing.items():
        if (r, c) not in incoming:
            for a in db.scalars(select(Asset).where(Asset.seat_id == s.id)):
                _relocate(db, a, None, m, operator_id=None)
            db.delete(s)

    existing_labels = {(lb.row, lb.col): lb for lb in labels_of(db, m.id)}
    for (r, c), lb in incoming_labels.items():
        cur = existing_labels.get((r, c))
        if cur:
            cur.text = lb.text.strip()[:32]
        else:
            db.add(MapLabel(map_id=m.id, row=r, col=c, text=lb.text.strip()[:32]))
    for (r, c), cur in existing_labels.items():
        if (r, c) not in incoming_labels:
            db.delete(cur)
    db.commit()


def _resync_locations(db: Session, m: FloorMap) -> None:
    """未编号工位的展示名由行列派生(R3C5),平移后要把资产的 location 同步过来。"""
    smap = {s.id: s for s in seats_of(db, m.id)}
    if not smap:
        return
    for a in db.scalars(select(Asset).where(Asset.seat_id.in_(list(smap)))):
        a.location = _label(m, smap[a.seat_id])


def _shift(db: Session, map_id: int, field: str, n: int) -> None:
    """把本图所有工位 + 备注的 row(或 col)整体 +n。

    (map_id,row,col) 上有唯一约束,而 Postgres 对非延迟约束是**逐行**检查的 ——
    直接 `SET row = row + n` 会在挪到一半时撞上还没挪的行。所以先整体挪到
    +1000 的空区间、再挪回目标位置:两条语句的目标值都与当时的现值不重叠,
    因此中途不会冲突。
    """
    for table in (Seat, MapLabel):
        col = getattr(table, field)
        db.execute(update(table).where(table.map_id == map_id).values({field: col + _SHIFT_PARK}))
        db.execute(
            update(table).where(table.map_id == map_id).values({field: col - _SHIFT_PARK + n})
        )
    db.expire_all()  # 上面走的是 Core UPDATE,让 ORM 对象重新读


def grow(db: Session, m: FloorMap, *, edge: str, count: int = 1) -> None:
    """在已有图的某条边上加行/列。

    下 / 右:只是把画布放大,已有坐标不动。
    上 / 左:画布放大之外,还要把已有工位与备注整体平移,保持相对位置不变。
    """
    if edge not in ("top", "bottom", "left", "right"):
        raise SeatMapError("方向只能是 上/下/左/右")
    n = int(count or 1)
    if n < 1:
        raise SeatMapError("至少加 1 行/列")
    vertical = edge in ("top", "bottom")
    cur = m.rows if vertical else m.cols
    if cur + n > MAX_DIM:
        raise SeatMapError(f"最多 {MAX_DIM} {'行' if vertical else '列'}")

    if vertical:
        m.rows = cur + n
    else:
        m.cols = cur + n
    # 先把新尺寸落库:_shift 里的 expire_all() 会丢掉尚未 flush 的改动
    db.flush()
    if edge == "top":
        _shift(db, m.id, "row", n)
    elif edge == "left":
        _shift(db, m.id, "col", n)
    _resync_locations(db, m)
    db.commit()


def autonumber(db: Session, m: FloorMap, *, order: str, per_zone: bool, prefix: str) -> None:
    seats = seats_of(db, m.id)  # row-major
    if order == "serpentine":
        ordered: list[Seat] = []
        for r, group in groupby(seats, key=lambda s: s.row):
            g = list(group)
            if r % 2 == 1:
                g.reverse()
            ordered.extend(g)
        seats = ordered
    counters: dict[str, int] = {}
    for s in seats:
        pfx = (s.zone or prefix) if per_zone else prefix
        counters[pfx] = counters.get(pfx, 0) + 1
        s.seat_no = f"{pfx}{counters[pfx]:02d}"
    # keep placed assets' derived location in sync with the new numbers
    smap = {s.id: s for s in seats}
    for a in db.scalars(select(Asset).where(Asset.seat_id.in_(list(smap) or [0]))):
        a.location = _label(m, smap[a.seat_id])
    db.commit()


# ── occupancy ─────────────────────────────────────────────────────────────────


def _seat_in_map(db: Session, m: FloorMap, seat_id: int) -> Seat:
    seat = db.get(Seat, seat_id)
    if seat is None or seat.map_id != m.id:
        raise SeatMapError("工位不存在")
    return seat


def assign_user(db: Session, m: FloorMap, seat_id: int, *, user_id: int, move_assets: bool) -> int:
    seat = _seat_in_map(db, m, seat_id)
    u = db.get(User, user_id)
    if u is None:
        raise SeatMapError("用户不存在")
    # 若该用户已坐在本图其它工位,先腾出——支持「座位间直接拖动换座」,免去
    # 「先清空再拖」两步。其名下资产随 move_assets 一并迁到新工位。
    for other in db.scalars(
        select(Seat).where(
            Seat.map_id == m.id, Seat.user_id == user_id, Seat.id != seat.id
        )
    ):
        other.user_id = None
    seat.user_id = user_id
    moved = 0
    if move_assets:
        q = select(Asset).where(
            Asset.owner_user_id == user_id,
            Asset.status == AssetStatus.in_use,
            Asset.asset_class == AssetClass.personal,
            Asset.deleted_at.is_(None),
        )
        for a in db.scalars(q):
            _relocate(db, a, seat, m, operator_id=None)
            moved += 1
    db.commit()
    return moved


def place_asset(db: Session, m: FloorMap, seat_id: int, *, asset_id: int) -> None:
    seat = _seat_in_map(db, m, seat_id)
    a = db.get(Asset, asset_id)
    if a is None or a.deleted_at is not None:
        raise SeatMapError("资产不存在")
    _relocate(db, a, seat, m, operator_id=None)
    db.commit()


def remove_asset(db: Session, m: FloorMap, *, asset_id: int) -> None:
    a = db.get(Asset, asset_id)
    if a is None:
        raise SeatMapError("资产不存在")
    _relocate(db, a, None, m, operator_id=None)
    db.commit()


def clear_seat(db: Session, m: FloorMap, seat_id: int) -> None:
    seat = _seat_in_map(db, m, seat_id)
    for a in db.scalars(select(Asset).where(Asset.seat_id == seat.id)):
        _relocate(db, a, None, m, operator_id=None)
    seat.user_id = None
    db.commit()


# ── side-panel candidates ─────────────────────────────────────────────────────


def candidates(db: Session, m: FloorMap, q: str | None) -> dict:
    seated = {s.user_id for s in seats_of(db, m.id) if s.user_id}
    ustmt = select(User).where(User.status == UserStatus.active)
    if q:
        ustmt = ustmt.where(User.name.ilike(f"%{q}%"))
    users = [u for u in db.scalars(ustmt.order_by(User.name).limit(80)) if u.id not in seated][:60]

    dept_ids = {u.department_id for u in users if u.department_id}
    depts = {
        d.id: d.name
        for d in db.scalars(select(Department).where(Department.id.in_(dept_ids or [0])))
    }
    counts: dict[int, int] = {}
    if users:
        rows = db.execute(
            select(Asset.owner_user_id, func.count())
            .where(
                Asset.owner_user_id.in_([u.id for u in users]),
                Asset.status == AssetStatus.in_use,
                Asset.asset_class == AssetClass.personal,
                Asset.deleted_at.is_(None),
            )
            .group_by(Asset.owner_user_id)
        )
        counts = {uid: n for uid, n in rows}

    astmt = select(Asset).where(Asset.seat_id.is_(None), Asset.deleted_at.is_(None))
    if q:
        like = f"%{q}%"
        astmt = astmt.where(Asset.asset_code.ilike(like) | Asset.brand_model.ilike(like))
    assets = db.scalars(astmt.order_by(Asset.asset_code).limit(60))

    return {
        "people": [
            {
                "id": u.id,
                "name": u.name,
                "department_name": depts.get(u.department_id),
                "asset_count": counts.get(u.id, 0),
            }
            for u in users
        ],
        "assets": [
            {"id": a.id, "asset_code": a.asset_code, "name": a.brand_model} for a in assets
        ],
    }
