from pydantic import BaseModel, Field


class DrawIn(BaseModel):
    name: str = ""
    tier: str | None = None
    winner_count: int = Field(ge=1, le=10000)
    prize_sku_id: int | None = None
    # Drop people who already won under the same activity name (default on).
    exclude_winners: bool = True


class WinnerSelection(BaseModel):
    # LotteryWinner ids to act on; None / omitted = all winners of the draw.
    winner_ids: list[int] | None = None
