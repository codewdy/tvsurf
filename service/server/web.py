import os
from aiohttp import web


class WebHandler:
    def __init__(self, path, default):
        self.path = path
        self.default = default

    async def __call__(self, request):
        path = (
            request.match_info["path"] if "path" in request.match_info else self.default
        )
        if os.path.exists(os.path.join(self.path, path)):
            return web.FileResponse(os.path.join(self.path, path))
        else:
            return web.FileResponse(os.path.join(self.path, self.default))


def web_routes(web_path, path, default):
    if not web_path.endswith("/"):
        web_path += "/"
    return [
        web.get(web_path, WebHandler(path, default)),
        web.get(web_path + "{path:.*}", WebHandler(path, default)),
    ]
