from aiohttp import web
from service.tracker.tracker import Tracker
from service.server.api import create_routes

async def handle_main(_request):
    """处理测试请求"""
    return web.Response(text="main")

def start():
    """启动 HTTP 服务"""
    tracker = Tracker()

    app = web.Application()
    
    # 注册路由
    app.router.add_get("/", handle_main)
    app.add_routes(create_routes(tracker))

    app.on_startup.append(lambda app: tracker.start())
    app.on_cleanup.append(lambda app: tracker.stop())

    # 启动服务
    web.run_app(app, host="0.0.0.0", port=9399, reuse_address=True, reuse_port=True)

if __name__ == "__main__":
    start()