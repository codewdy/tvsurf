from service.server.api import api
from service.schema.api import Echo
from service.lib.context import Context

class Tracker:
    def __init__(self):
        self.context: Context = Context()

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