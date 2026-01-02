from service.server.api import api
from service.schema.api import Echo, SearchTV
from service.lib.context import Context
from service.searcher.searchers import Searchers


class Tracker:
    def __init__(self):
        self.context: Context = Context()
        self.searchers = Searchers()

    async def start(self):
        print("Tracker started")
        await self.context.__aenter__()

    async def stop(self):
        print("Tracker stopped")
        await self.context.__aexit__(None, None, None)

    @api
    async def echo(self, request: Echo.Request):
        msg = request.message
        return Echo.Response(message=msg)

    @api
    async def search_tv(self, request: SearchTV.Request):
        keyword = request.keyword
        return SearchTV.Response(source=await self.searchers.search(keyword))
