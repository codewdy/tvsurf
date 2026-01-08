from service.lib.context import Context
from service.schema.user_db import UserDB, User
from uuid import uuid4


_SINGLE_USER_NAME = "user"


class UserManager:
    async def start(self):
        self.db = Context.data("db").manage("user_db", UserDB)

    def has_user(self):
        return len(self.db.users) > 0

    def set_single_user_mode(self):
        if self.has_user():
            raise Exception("系统已设置")
        token = str(uuid4())
        self.db.single_user_mode = True
        self.db.users[_SINGLE_USER_NAME] = User(
            username=_SINGLE_USER_NAME,
            password_md5="",
            token=token,
            group=["user", "admin"],
        )
        self.db.commit()
        return token

    def add_user(self, username: str, password_md5: str, group: list[str]):
        if self.db.single_user_mode:
            raise Exception("单用户模式下无法添加用户")
        if username in self.db.users:
            raise KeyError(f"用户 {username} 已存在")
        token = str(uuid4())
        self.db.users[username] = User(
            username=username, password_md5=password_md5, token=token, group=group
        )
        self.db.commit()
        return token

    def get_user(self, token: str):
        if self.db.single_user_mode:
            return self.db.users[_SINGLE_USER_NAME]
        return next(
            (user for user in self.db.users.values() if user.token == token), None
        )

    @property
    def single_user_mode(self):
        return self.db.single_user_mode
