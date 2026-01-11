from .dtype import BaseModel


class User(BaseModel):
    username: str
    password_hash: str
    token: str
    group: list[str]


class UserDB(BaseModel):
    users: dict[str, User] = {}
    single_user_mode: bool = False
