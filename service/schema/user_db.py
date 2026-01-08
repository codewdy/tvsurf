from .dtype import BaseModel


class User(BaseModel):
    group: list[str]


class UserDB(BaseModel):
    users: dict[str, User]
