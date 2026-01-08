import os
from aiohttp import web


class WebHandler:
    def __init__(self, path, default, logins):
        self.path = path
        self.default = default
        self.logins = logins

    async def __call__(self, request):
        path = (
            request.match_info["path"] if "path" in request.match_info else self.default
        )
        print(path)
        if path in self.logins:
            status = 401
        else:
            status = 200
        if os.path.exists(os.path.join(self.path, path)):
            return web.FileResponse(os.path.join(self.path, path), status=status)
        else:
            return web.FileResponse(
                os.path.join(self.path, self.default), status=status
            )


def web_routes(web_path, path, default, logins):
    if not web_path.endswith("/"):
        web_path += "/"
    handler = WebHandler(path, default, logins)
    return [web.get(web_path, handler), web.get(web_path + "{path:.*}", handler)]
