from pydantic import BaseModel, ConfigDict

from app.modules.users.models import Role, UserStatus


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str | None
    mobile: str | None
    department_id: int | None
    role: Role
    status: UserStatus


class LoginResult(BaseModel):
    token: str
    user: UserOut


class MeResult(BaseModel):
    user: UserOut
    permissions: list[str]
