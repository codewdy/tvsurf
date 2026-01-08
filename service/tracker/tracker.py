from service.server.api import api, login, get_user
from service.schema.api import *
from service.lib.context import Context
from service.searcher.searchers import Searchers
import os
from .db import DB
from .local_manager import LocalManager
from .error_db import ErrorDB
from .user_manager import UserManager
from service.schema.user_db import User
from typing import Optional


class Tracker:
    def __init__(self):
        self.context: Context = Context()
        self.searchers = Searchers()
        self.db = DB()
        self.local_manager = LocalManager()
        self.user_manager = UserManager()
        self.error_db = ErrorDB()

    async def start(self):
        print("Tracker started")
        await self.context.__aenter__()
        with Context.handle_error("tracker start failed", rethrow=True):
            os.makedirs(self.context.config.data_dir, exist_ok=True)
            self.db.start()
            Context.set_data("db", self.db)
            await self.error_db.start()
            await self.local_manager.start()
            await self.user_manager.start()

    async def stop(self):
        print("Tracker stopped")
        self.db.save()
        await self.local_manager.stop()
        self.db.stop()
        print("Tracker stopped successfully")
        await self.context.__aexit__(None, None, None)

    def need_system_setup(self):
        return not self.user_manager.has_user()

    def token_validate(self, token: str):
        return self.get_user(token) is not None

    @get_user
    def get_user(self, token: str) -> Optional[User]:
        return self.user_manager.get_user(token)

    @login
    async def system_setup(self, request: SystemSetup.Request):
        if self.user_manager.has_user():
            raise Exception("系统已设置")
        return SystemSetup.Response(
            token=self.user_manager.add_user(
                request.username, request.password_md5, ["user", "admin"]
            )
        )

    @api("user")
    async def whoami(self, user: User, request: Whoami.Request):
        return Whoami.Response(username=user.username, group=user.group)

    @api("user")
    async def echo(self, user: User, request: Echo.Request):
        msg = request.message
        return Echo.Response(message=msg)

    @api("user")
    async def search_tv(self, user: User, request: SearchTV.Request):
        keyword = request.keyword
        return SearchTV.Response(source=await self.searchers.search(keyword))

    @api("user")
    async def add_tv(self, user: User, request: AddTV.Request):
        name = request.name
        source = request.source
        return AddTV.Response(id=await self.local_manager.add_tv(name, source))

    @api("user")
    async def get_download_progress(
        self, user: User, request: GetDownloadProgress.Request
    ):
        return GetDownloadProgress.Response(
            progress=self.local_manager.get_download_progress()
        )

    @api("user")
    async def get_errors(self, user: User, request: GetErrors.Request):
        return GetErrors.Response(errors=self.error_db.get_errors())

    @api("admin")
    async def remove_errors(self, user: User, request: RemoveErrors.Request):
        self.error_db.remove_errors(request.ids)
        return RemoveErrors.Response()
