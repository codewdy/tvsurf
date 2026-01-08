from aiohttp import web
from service.lib.context import Context
import json


def api(func):
    func.__api__ = _wrap_api
    return func


def login(func):
    func.__api__ = _wrap_login
    return func


def _wrap_api(name, func):
    request_type = func.__annotations__["request"]

    async def wrapper(request):
        try:
            with Context.handle_error(f"API {name} 处理失败", rethrow=True):
                text = await request.text()
                request = request_type.model_validate_json(text)
                return web.json_response(text=(await func(request)).model_dump_json())
        except Exception as e:
            return web.Response(text=repr(e), status=500)

    return wrapper


def _wrap_login(name, func):
    request_type = func.__annotations__["request"]

    async def wrapper(request):
        try:
            with Context.handle_error(f"API {name} 处理失败", rethrow=True):
                text = await request.text()
                request = request_type.model_validate_json(text)
                response_data = await func(request)
                response = web.json_response(text=response_data.model_dump_json())
                response.set_cookie("token", response_data.token)
                return response
        except Exception as e:
            return web.Response(text=repr(e), status=500)

    return wrapper


def create_routes(api_handler):
    routes = []
    for name, func in api_handler.__class__.__dict__.items():
        if hasattr(func, "__api__"):
            wrapper = func.__api__(name, getattr(api_handler, name))
            routes.append(web.post(f"/api/{name}", wrapper))
    return routes
