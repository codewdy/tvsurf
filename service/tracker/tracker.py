from service.server.api import api
from service.schema.api import *
from service.lib.context import Context
from service.searcher.searchers import Searchers
import os
from .db import DB
from .local_manager import LocalManager
from .error_db import ErrorDB


class Tracker:
    def __init__(self):
        self.context: Context = Context()
        self.searchers = Searchers()
        self.db = DB()
        self.local_manager = LocalManager()
        self.error_db = ErrorDB()

    async def start(self):
        print("Tracker started")
        await self.context.__aenter__()
        os.makedirs(self.context.config.data_dir, exist_ok=True)
        self.db.start()
        Context.set_data("db", self.db)
        await self.error_db.start()
        await self.local_manager.start()

    async def stop(self):
        print("Tracker stopped")
        self.db.save()
        await self.local_manager.stop()
        self.db.stop()
        print("Tracker stopped successfully")
        await self.context.__aexit__(None, None, None)

    @api
    async def echo(self, request: Echo.Request):
        msg = request.message
        return Echo.Response(message=msg)

    @api
    async def search_tv(self, request: SearchTV.Request):
        keyword = request.keyword
        return SearchTV.Response(source=await self.searchers.search(keyword))

    @api
    async def add_tv(self, request: AddTV.Request):
        name = request.name
        source = request.source
        return AddTV.Response(id=await self.local_manager.add_tv(name, source))

    @api
    async def get_download_progress(self, request: GetDownloadProgress.Request):
        return GetDownloadProgress.Response(
            progress=self.local_manager.get_download_progress()
        )

    @api
    async def get_errors(self, request: GetErrors.Request):
        return GetErrors.Response(errors=self.error_db.get_errors())

    @api
    async def remove_errors(self, request: RemoveErrors.Request):
        self.error_db.remove_errors(request.ids)
        return RemoveErrors.Response()
