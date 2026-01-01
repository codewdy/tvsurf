from .lib.context import Context
import sys
import asyncio
from aiohttp import web

async def test():
    async with Context() as ctx:
        page = await ctx.browser.new_page()
        await page.goto("https://baidu.com", timeout=60000)
        rst = await page.title()
        await page.close()
        return rst

async def handle_test(request):
    """处理测试请求"""
    result = await test()
    return web.Response(text=result)

async def handle_health(request):
    """健康检查端点"""
    return web.json_response({"status": "ok"})

def start():
    """启动 HTTP 服务"""
    app = web.Application()
    
    # 注册路由
    app.router.add_get("/", handle_test)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/test", handle_test)
    
    # 启动服务
    web.run_app(app, host="0.0.0.0", port=9399)

if __name__ == "__main__":
    start()