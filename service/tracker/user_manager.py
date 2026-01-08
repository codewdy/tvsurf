from service.lib.context import Context
from service.schema.user_db import UserDB, User
from uuid import uuid4


class UserManager:
    async def start(self):
        self.db = Context.data("db").manage("user_db", UserDB)

    def has_user(self):
        return len(self.db.users) > 0

    def add_user(self, username: str, password_md5: str, group: list[str]):
        if username in self.db.users:
            raise KeyError(f"用户 {username} 已存在")
        token = str(uuid4())
        self.db.users[username] = User(
            username=username, password_md5=password_md5, token=token, group=group
        )
        self.db.commit()
        return token

    def get_user(self, token: str):
        return next(
            (user for user in self.db.users.values() if user.token == token), None
        )
