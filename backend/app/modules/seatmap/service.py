"""座位图 service.

落座 = 把工位的展示名回写到 `Asset.location`(派生冗余,兼容既有台账/导出/筛选)
并记一条 relocate 生命周期。撤离/删除工位/删除图都会把相关资产的 location 清回,
同样留痕。所有写位置的动作都经 `_relocate`,保证台账与工位单一出口。
"""
from itertools import groupby

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.modules.assets.models import Asset, AssetChangeLog, AssetClass, AssetStatus
from app.modules.seatmap.models import FloorMap, Seat
from app.modules.users.models import Department, User, UserStatus


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


def map_payload(db: Session, m: FloorMap) -> dict:
    """Assemble the map + enriched seats (occupant name + placed assets)."""
    seats = seats_of(db, m.id)
    on = _assets_on(db, [s.id for s in seats])
    uids = {s.user_id for s in seats if s.user_id}
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(uids or [0])))}
    return {
        "map": m,
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
    db.delete(m)
    db.commit()


# ── layout / numbering ────────────────────────────────────────────────────────


def set_layout(db: Session, m: FloorMap, cells: list) -> None:
    """Replace the set of seat cells (add new, update zone, remove absent).
    Removing a seat first moves any assets on it off the map."""
    existing = {(s.row, s.col): s for s in seats_of(db, m.id)}
    incoming = {
        (c.row, c.col): c
        for c in cells
        if 0 <= c.row < m.rows and 0 <= c.col < m.cols
    }
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
