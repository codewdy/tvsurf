import asyncio
from aiohttp import web
from service.tracker.tracker import Tracker
from service.server.api import create_routes
from aiohttp.web_runner import _raise_graceful_exit
from service.lib.path import web_path
from service.server.web import web_routes
import base64


async def handle_main(_request):
    """处理测试请求"""
    return web.Response(text="main")


_loop: asyncio.AbstractEventLoop | None = None


def stop():
    """停止 HTTP 服务"""
    global _loop
    if _loop is None:
        return
    loop = _loop
    loop.call_soon_threadsafe(_raise_graceful_exit)
    _loop = None


def start():
    """启动 HTTP 服务"""
    global _loop
    tracker = Tracker()

    app = web.Application()

    def redirect_func(token: str, path: str):
        if path == "/favicon.ico" or path.startswith("/assets/"):
            return None
        if tracker.need_system_setup():
            return "/system_setup?redirect=" + base64.b64encode(path.encode()).decode()
        if not tracker.token_validate(token):
            return "/system_setup?redirect=" + base64.b64encode(path.encode()).decode()
        return None

    # 注册路由
    # app.router.add_get("/", handle_main)
    app.add_routes(create_routes(tracker))
    app.add_routes(
        web_routes("/", web_path(), "index.html", ["system_setup"], redirect_func)
    )

    app.on_startup.append(lambda app: tracker.start())
    app.on_cleanup.append(lambda app: tracker.stop())

    loop = asyncio.new_event_loop()
    _loop = loop
    # 启动服务
    web.run_app(app, host="0.0.0.0", port=9399, loop=loop)


if __name__ == "__main__":
    start()
