from aiohttp import web


def api(func):
    func.__api__ = True
    return func


def _wrap(func):
    request_type = func.__annotations__["request"]

    async def wrapper(request):
        text = await request.text()
        request = request_type.model_validate_json(text)
        return web.json_response(text=(await func(request)).model_dump_json())
    return wrapper


def create_routes(api_handler):
    routes = []
    api = {}
    for name, func in api_handler.__class__.__dict__.items():
        if hasattr(func, "__api__"):
            api[name] = getattr(api_handler, name)
    for name, func in api.items():
        routes.append(
            web.post(f"/api/{name}", _wrap(func)))
    return routes
