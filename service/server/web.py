import os
from aiohttp import web
from typing import Callable, Optional
from aiohttp.web import RouteDef


class WebHandler:
    def __init__(
        self,
        path: str,
        default: str,
        logins: list[str],
        redirect_func: Callable[[Optional[str], str], Optional[str]],
    ) -> None:
        self.path = path
        self.default = default
        self.logins = logins
        self.redirect_func = redirect_func

    async def __call__(self, request: web.Request) -> web.StreamResponse:
        path = (
            request.match_info["path"] if "path" in request.match_info else self.default
        )
        if path not in self.logins:
            redirect = self.redirect_func(
                request.cookies.get("token", None), request.raw_path
            )
            if redirect:
                return web.Response(status=302, headers={"Location": redirect})
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


def web_routes(
    web_path: str,
    path: str,
    default: str,
    logins: list[str],
    redirect_func: Callable[[Optional[str], str], Optional[str]],
) -> list[RouteDef]:
    if not web_path.endswith("/"):
        web_path += "/"
    handler = WebHandler(path, default, logins, redirect_func)
    return [web.get(web_path, handler), web.get(web_path + "{path:.*}", handler)]
