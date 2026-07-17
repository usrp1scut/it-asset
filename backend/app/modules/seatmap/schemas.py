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


class SeatAssetOut(BaseModel):
    id: int
    asset_code: str
    name: str | None = None


class SeatOut(BaseModel):
    id: int
    row: int
    col: int
    seat_no: str | None
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


class AutoNumberIn(BaseModel):
    order: str = "row"        # row | serpentine
    per_zone: bool = True     # 各区独立编号(用 zone 作前缀)
    prefix: str = "A"         # per_zone=False 或无 zone 时的前缀


class AssignUserIn(BaseModel):
    user_id: int
    move_assets: bool = True  # 同时把 TA 名下在用个人资产移到该工位


class PlaceAssetIn(BaseModel):
    asset_id: int


class CandidatePerson(BaseModel):
    id: int
    name: str
    department_name: str | None = None
    asset_count: int = 0


class CandidatesOut(BaseModel):
    people: list[CandidatePerson]
    assets: list[SeatAssetOut]
