"""座位图 API — 网格布局 + 自动编号 + 拖拽落座(人/设备),落座回写资产台账位置。

查看:staff(含 HR);变更:it_admin。所有变更后统一返回 map 详情(前端整图刷新)。
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.deps import get_db
from app.modules.perms.deps import require_perm
from app.modules.seatmap import pdf as seatmap_pdf
from app.modules.seatmap import service
from app.modules.seatmap.schemas import (
    AssignUserIn,
    AutoNumberIn,
    CandidatesOut,
    LayoutIn,
    MapCreate,
    MapDetail,
    MapOut,
    PlaceAssetIn,
)
from app.modules.users.models import User

router = APIRouter(prefix="/api/seatmaps", tags=["seatmap"])
staff = require_perm("seatmap", "view")
it_admin = require_perm("seatmap", "manage")


def _get(db: Session, map_id: int):
    m = service.get_map(db, map_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "座位图不存在")
    return m


@router.get("", response_model=list[MapOut])
def list_maps(db: Session = Depends(get_db), _: User = Depends(staff)):
    return service.list_maps(db)


@router.post("", response_model=MapDetail, status_code=status.HTTP_201_CREATED)
def create_map(body: MapCreate, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    m = service.create_map(db, name=body.name, rows=body.rows, cols=body.cols, created_by=user.id)
    return service.map_payload(db, m)


@router.get("/{map_id}", response_model=MapDetail)
def get_map(map_id: int, db: Session = Depends(get_db), _: User = Depends(staff)):
    return service.map_payload(db, _get(db, map_id))


@router.delete("/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_map(map_id: int, db: Session = Depends(get_db), _: User = Depends(it_admin)):
    service.delete_map(db, _get(db, map_id))


@router.get("/{map_id}/export")
def export_pdf(map_id: int, db: Session = Depends(get_db), _: User = Depends(staff)):
    """A4 landscape PDF floor plan of the map (vector, printable)."""
    m = _get(db, map_id)
    data = seatmap_pdf.render_seatmap_pdf(db, m)
    return StreamingResponse(
        iter([data]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=seatmap-{map_id}.pdf"},
    )


@router.get("/{map_id}/candidates", response_model=CandidatesOut)
def candidates(map_id: int, q: str | None = None, db: Session = Depends(get_db),
               _: User = Depends(staff)):
    return service.candidates(db, _get(db, map_id), q)


@router.put("/{map_id}/layout", response_model=MapDetail)
def set_layout(map_id: int, body: LayoutIn, db: Session = Depends(get_db),
               _: User = Depends(it_admin)):
    m = _get(db, map_id)
    service.set_layout(db, m, body.seats)
    return service.map_payload(db, m)


@router.post("/{map_id}/autonumber", response_model=MapDetail)
def autonumber(map_id: int, body: AutoNumberIn, db: Session = Depends(get_db),
               _: User = Depends(it_admin)):
    m = _get(db, map_id)
    service.autonumber(db, m, order=body.order, per_zone=body.per_zone, prefix=body.prefix)
    return service.map_payload(db, m)


def _mutate(db: Session, map_id: int, fn) -> MapDetail:
    m = _get(db, map_id)
    try:
        fn(m)
    except service.SeatMapError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return service.map_payload(db, m)


@router.post("/{map_id}/seats/{seat_id}/assign-user", response_model=MapDetail)
def assign_user(map_id: int, seat_id: int, body: AssignUserIn, db: Session = Depends(get_db),
                _: User = Depends(it_admin)):
    return _mutate(db, map_id, lambda m: service.assign_user(
        db, m, seat_id, user_id=body.user_id, move_assets=body.move_assets))


@router.post("/{map_id}/seats/{seat_id}/place-asset", response_model=MapDetail)
def place_asset(map_id: int, seat_id: int, body: PlaceAssetIn, db: Session = Depends(get_db),
                _: User = Depends(it_admin)):
    return _mutate(
        db, map_id, lambda m: service.place_asset(db, m, seat_id, asset_id=body.asset_id)
    )


@router.post("/{map_id}/seats/{seat_id}/clear", response_model=MapDetail)
def clear_seat(map_id: int, seat_id: int, db: Session = Depends(get_db),
               _: User = Depends(it_admin)):
    return _mutate(db, map_id, lambda m: service.clear_seat(db, m, seat_id))


@router.delete("/{map_id}/assets/{asset_id}", response_model=MapDetail)
def remove_asset(map_id: int, asset_id: int, db: Session = Depends(get_db),
                 _: User = Depends(it_admin)):
    return _mutate(db, map_id, lambda m: service.remove_asset(db, m, asset_id=asset_id))
