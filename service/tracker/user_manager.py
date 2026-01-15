from service.lib.context import Context
from service.schema.user_db import UserDB, User
from uuid import uuid4
from typing import Optional
import re


_SINGLE_USER_NAME = "user"


class UserManager:
    async def start(self) -> None:
        self.db = Context.data("db").manage("user_db", UserDB)

    def has_user(self) -> bool:
        return len(self.db.users) > 0

    def validate_username(self, username: str):
        """验证用户名是否只包含字母、数字、下划线和减号"""
        if not username:
            return False
        # 只允许字母（大小写）、数字、下划线(_)和减号(-)
        pattern = r"^[a-zA-Z0-9_-]+$"
        if not bool(re.match(pattern, username)):
            raise ValueError("用户名只能包含字母、数字、下划线和减号")

    def set_single_user_mode(self) -> str:
        if self.has_user():
            raise Exception("系统已设置")
        token = str(uuid4())
        self.db.single_user_mode = True
        self.db.users[_SINGLE_USER_NAME] = User(
            username=_SINGLE_USER_NAME,
            password_hash="",
            token=token,
            group=["user", "admin"],
        )
        self.db.commit()
        return token

    def add_user(self, username: str, password_hash: str, group: list[str]) -> str:
        if self.db.single_user_mode:
            raise Exception("单用户模式下无法添加用户")
        self.validate_username(username)
        if username in self.db.users:
            raise KeyError(f"用户 {username} 已存在")
        token = str(uuid4())
        self.db.users[username] = User(
            username=username, password_hash=password_hash, token=token, group=group
        )
        self.db.commit()
        return token

    def get_user(self, token: Optional[str]) -> Optional[User]:
        if self.db.single_user_mode:
            return self.db.users[_SINGLE_USER_NAME]
        return next(
            (user for user in self.db.users.values() if user.token == token), None
        )

    def get_user_token(self, username: str, password_hash: str) -> str:
        if self.db.single_user_mode:
            return self.db.users[_SINGLE_USER_NAME].token
        self.validate_username(username)
        user = next(
            (
                user
                for user in self.db.users.values()
                if user.username == username and user.password_hash == password_hash
            ),
            None,
        )
        if user is None:
            raise Exception("用户名或密码错误")
        return user.token

    def set_user_password(self, username: str, password_hash: str) -> None:
        if self.db.single_user_mode:
            raise Exception("单用户模式下无法设置用户密码")
        self.validate_username(username)
        user = self.db.users[username]
        user.password_hash = password_hash
        self.db.commit()

    @property
    def single_user_mode(self) -> bool:
        return self.db.single_user_mode
