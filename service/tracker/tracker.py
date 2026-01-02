from service.server.api import api
from service.schema.api import Echo

class Tracker:
    def __init__(self):
        pass

    async def start(self):
        print("Tracker started")

    async def stop(self):
        print("Tracker stopped")

    @api
    async def echo(self, request: Echo.Request):
        return Echo.Response(message=request.message)