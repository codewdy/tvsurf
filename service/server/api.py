from tkinter import TRUE
from aiohttp import web
from service.lib.context import Context
import json
from dataclasses import dataclass
from typing import Optional, Callable
from service.schema.user_db import User


@dataclass
class ApiContext:
    get_user: Callable[[str], Optional[User]]


def get_user(func):
    func.__get_user__ = TRUE
    return func


def api(group):
    def wrapper(func):
        func.__api__ = lambda *args: _wrap_api(group, *args)
        return func

    return wrapper


def login(func):
    func.__api__ = _wrap_login
    return func


def _wrap_api(group, name, func, context):
    request_type = func.__annotations__["request"]

    async def wrapper(request):
        try:
            with Context.handle_error(f"API {name} 处理失败", rethrow=True):
                token = request.cookies.get("token", None)
                user = context.get_user(token)
                if user is None:
                    return web.Response(
                        text="Unauthorized: cannot find user", status=401
                    )
                if group not in user.group:
                    return web.Response(
                        text=f"Unauthorized: user not in group {group}", status=401
                    )
                text = await request.text()
                request = request_type.model_validate_json(text)
                return web.json_response(
                    text=(await func(user, request)).model_dump_json()
                )
        except Exception as e:
            return web.Response(text=repr(e), status=500)

    return wrapper


def _wrap_login(name, func, context):
    request_type = func.__annotations__["request"]

    async def wrapper(request):
        try:
            with Context.handle_error(f"API {name} 处理失败", rethrow=True):
                text = await request.text()
                request = request_type.model_validate_json(text)
                response_data = await func(request)
                response = web.json_response(text=response_data.model_dump_json())
                response.set_cookie(
                    "token", response_data.token, max_age=60 * 60 * 24 * 365  # 1 year
                )
                return response
        except Exception as e:
            return web.Response(text=repr(e), status=500)

    return wrapper


def create_routes(api_handler):
    context = {}
    for name, func in api_handler.__class__.__dict__.items():
        if hasattr(func, "__get_user__"):
            context["get_user"] = getattr(api_handler, name)
    context = ApiContext(**context)

    routes = []
    for name, func in api_handler.__class__.__dict__.items():
        if hasattr(func, "__api__"):
            wrapper = func.__api__(name, getattr(api_handler, name), context)
            routes.append(web.post(f"/api/{name}", wrapper))
    return routes
