from aiohttp import web
from service.lib.context import Context
import json
from dataclasses import dataclass
from typing import Optional, Callable, Any, Type, Awaitable
from service.schema.user_db import User
from .constant import TOKEN


@dataclass
class ApiContext:
    get_user: Callable[[Optional[str]], Optional[User]]


def get_user(func: Callable) -> Callable:
    func.__get_user__ = True
    return func


def api(group: str) -> Callable[[Callable], Callable]:
    def wrapper(func: Callable) -> Callable:
        func.__api__ = lambda *args: _wrap_api(group, *args)
        return func

    return wrapper


def login(func: Callable) -> Callable:
    func.__api__ = _wrap_login
    return func


def _wrap_api(
    group: str, name: str, func: Callable, context: ApiContext
) -> Callable[[web.Request], Awaitable[web.Response]]:
    request_type = func.__annotations__.get("request")
    if request_type is None:
        raise ValueError(f"Function {name} must have 'request' annotation")

    async def wrapper(request: web.Request) -> web.Response:
        try:
            with Context.handle_error(f"API {name} 处理失败", rethrow=True):
                token = request.cookies.get(TOKEN, None)
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
                request_obj = request_type.model_validate_json(text)
                return web.json_response(
                    text=(await func(user, request_obj)).model_dump_json()
                )
        except Exception as e:
            return web.Response(text=repr(e), status=500)

    return wrapper


def _wrap_login(
    name: str, func: Callable, context: ApiContext
) -> Callable[[web.Request], Awaitable[web.Response]]:
    request_type = func.__annotations__.get("request")
    if request_type is None:
        raise ValueError(f"Function {name} must have 'request' annotation")

    async def wrapper(request: web.Request) -> web.Response:
        try:
            with Context.handle_error(f"API {name} 处理失败", rethrow=True):
                text = await request.text()
                request_obj = request_type.model_validate_json(text)
                response_data = await func(request_obj)
                response = web.json_response(text=response_data.model_dump_json())
                response.set_cookie(
                    TOKEN, response_data.token, max_age=60 * 60 * 24 * 365  # 1 year
                )
                return response
        except Exception as e:
            return web.Response(text=repr(e), status=500)

    return wrapper


def create_routes(api_handler: Any) -> list[web.RouteDef]:
    context: dict[str, Any] = {}
    for name, func in api_handler.__class__.__dict__.items():
        if hasattr(func, "__get_user__"):
            context["get_user"] = getattr(api_handler, name)
    api_context = ApiContext(**context)

    routes: list[web.RouteDef] = []
    for name, func in api_handler.__class__.__dict__.items():
        if hasattr(func, "__api__"):
            wrapper = func.__api__(name, getattr(api_handler, name), api_context)
            routes.append(web.post(f"/api/{name}", wrapper))
    return routes
