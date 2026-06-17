from pydantic import BaseModel, Field


class DrawIn(BaseModel):
    name: str = ""
    winner_count: int = Field(ge=1, le=10000)
    prize_sku_id: int | None = None
