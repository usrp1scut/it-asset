from typing import Literal

from pydantic import BaseModel, ConfigDict


class MapCreate(BaseModel):
    name: str
    rows: int = 6
    cols: int = 8


class MapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    rows: int
    cols: int
    version: int = 1   # 布局几何版本;保存布局时回传做乐观锁


class SeatAssetOut(BaseModel):
    id: int
    asset_code: str
    name: str | None = None


class SeatOut(BaseModel):
    id: int
    row: int
    col: int
    seat_no: str | None
    alias: str | None = None
    display_no: str = ""   # 别名 → 编号 → 行列;界面/导出显示用
    zone: str | None
    user_id: int | None
    user_name: str | None = None
    assets: list[SeatAssetOut] = []


class MapLabelOut(BaseModel):
    id: int
    row: int
    col: int
    text: str


class MapDetail(BaseModel):
    map: MapOut
    seats: list[SeatOut]
    labels: list[MapLabelOut] = []


class LayoutCell(BaseModel):
    row: int
    col: int
    zone: str | None = None


class LabelCell(BaseModel):
    row: int
    col: int
    text: str


class LayoutIn(BaseModel):
    seats: list[LayoutCell]
    # 空白格上的位置备注(窗/柜子/机房/前台…);与 seats 互斥同一格
    labels: list[LabelCell] = []
    # 进入编辑时的 map.version。带上就做乐观锁:期间有人改过布局 -> 409,
    # 免得旧快照静默删掉别人新加的工位。省略则不校验(脚本/兼容用)。
    version: int | None = None


class GrowIn(BaseModel):
    """在已有图的某条边加行/列。上/左会把已有工位与备注整体平移。"""

    edge: Literal["top", "bottom", "left", "right"]
    count: int = 1


class AutoNumberIn(BaseModel):
    order: str = "row"        # row | serpentine
    per_zone: bool = True     # 各区独立编号(用 zone 作前缀)
    prefix: str = "A"         # per_zone=False 或无 zone 时的前缀


class AssignUserIn(BaseModel):
    user_id: int
    move_assets: bool = True  # 同时把 TA 名下在用个人资产移到该工位


class PlaceAssetIn(BaseModel):
    asset_id: int


class SeatAliasIn(BaseModel):
    """工位别名;空 -> 清除别名,回落到自动编号显示。"""

    alias: str | None = None


class CandidatePerson(BaseModel):
    id: int
    name: str
    department_name: str | None = None
    asset_count: int = 0


class CandidatesOut(BaseModel):
    people: list[CandidatePerson]
    assets: list[SeatAssetOut]
