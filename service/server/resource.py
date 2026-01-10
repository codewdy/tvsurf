import os
from aiohttp import web
from typing import Callable, Optional
from aiohttp.web import RouteDef
from .constant import TOKEN


class ResourceHandler:
    def __init__(
        self,
        path: str,
        valid_token: Callable[[Optional[str]], bool],
    ) -> None:
        self.path = path
        self.valid_token = valid_token

    async def __call__(self, request: web.Request) -> web.StreamResponse:
        if not self.valid_token(request.cookies.get(TOKEN, None)):
            return web.Response(text="Unauthorized", status=401)
        return web.FileResponse(os.path.join(self.path, request.match_info["path"]))


def resource_routes(
    web_path: str,
    path: str,
    valid_token: Callable[[Optional[str]], bool],
) -> list[RouteDef]:
    if not web_path.endswith("/"):
        web_path += "/"
    handler = ResourceHandler(path, valid_token)
    return [web.get(web_path + "{path:.*}", handler)]
