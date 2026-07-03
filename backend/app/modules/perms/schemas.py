from pydantic import BaseModel


class GrantChange(BaseModel):
    role: str
    module: str
    can_view: bool
    can_manage: bool


class MatrixUpdate(BaseModel):
    changes: list[GrantChange]
