"""座位图(Seat map)模型.

管理员在一张网格画布上摆工位:`FloorMap` 是一张图(一层/一个区),`Seat`
是图上的一个工位格子(只持久化「工位」格,过道/空 = 没有行)。工位可坐一个人
(`user_id`),设备则通过 `Asset.seat_id` 挂到工位上。资产落座时把工位的展示名
写回 `Asset.location`(派生冗余,兼容既有台账/导出),并记一条 relocate 生命周期。
"""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class FloorMap(Base):
    __tablename__ = "floor_maps"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    rows: Mapped[int] = mapped_column(Integer, default=6)
    cols: Mapped[int] = mapped_column(Integer, default=8)
    created_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("map_id", "row", "col", name="uq_seat_map_cell"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("floor_maps.id"), index=True)
    row: Mapped[int] = mapped_column(Integer)
    col: Mapped[int] = mapped_column(Integer)
    seat_no: Mapped[str | None] = mapped_column(String(16))  # 自动编号,如 A05
    # 人读的别名(如「研发-12」)。设了就在地图/弹窗/导出里**替代编号显示**;
    # 自动编号只重算 seat_no,不会覆盖它。台账 location 仍按 seat_no 派生
    # (见 _label),所以改别名不会扰动资产台账历史。
    alias: Mapped[str | None] = mapped_column(String(32))
    zone: Mapped[str | None] = mapped_column(String(16))     # 区域,如 A / B
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))  # 就座的人


class MapLabel(Base):
    """空白格上的位置备注(窗 / 柜子 / 机房 / 前台 …)。

    纯粹是平面图上的参照物注记:不参与自动编号与统计,不能坐人、不能放设备。
    一个格子要么是工位、要么是备注,二者互斥(见 service.set_layout 的校验)。
    """

    __tablename__ = "map_labels"
    __table_args__ = (UniqueConstraint("map_id", "row", "col", name="uq_label_map_cell"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("floor_maps.id"), index=True)
    row: Mapped[int] = mapped_column(Integer)
    col: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(String(32))
