from playwright.async_api import async_playwright, Playwright, Browser
from typing import AsyncContextManager
import threading
import aiohttp
from .path import chromium_path
from .error_handler import ErrorHandler
from .logger import get_logger
import logging
from service.schema.config import Config
from typing import Any


class ContextMeta(type):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._current_holder = threading.local()

    @property
    def current(cls):
        return cls._current_holder.context

    @property
    def browser(cls):
        return cls.current.browser

    @property
    def client(cls):
        return cls.current.client

    def handle_error(cls, title: str, type: str = "error", rethrow=False):
        return cls.current.error_handler.handle_error_context(
            title, type, rethrow=rethrow
        )

    def info(cls, msg: str, *args, **kwargs):
        cls.current.logger.info(msg, *args, **kwargs)

    def debug(cls, msg: str, *args, **kwargs):
        cls.current.logger.debug(msg, *args, **kwargs)

    def error(cls, msg: str, *args, **kwargs):
        cls.current.logger.error(msg, *args, **kwargs)

    def warning(cls, msg: str, *args, **kwargs):
        cls.current.logger.warning(msg, *args, **kwargs)

    def data(cls, name: str):
        return cls.current.data[name]

    def set_data(cls, name: str, d: Any):
        cls.current.data[name] = d

    @property
    def config(cls):
        return cls.current.config


class Context(metaclass=ContextMeta):
    _current_holder = threading.local()

    def __init__(
        self,
        config: Config | None = None,
        logger: logging.Logger | None = None,
    ):
        self.config = config or Config()
        self.logger = logger or get_logger(logging.INFO)
        self.error_handler = ErrorHandler()
        self.error_handler.add_handler(
            "error", lambda title, error: self.logger.error(f"{title}: {error}")
        )
        self.error_handler.add_handler(
            "critical", lambda title, error: self.logger.critical(f"{title}: {error}")
        )
        self.data = {}

    async def __aenter__(self):
        self._current_holder.context = self

        # playwright
        self.playwright: AsyncContextManager[Playwright] = async_playwright()
        self.playwright_ctx: Playwright = await self.playwright.__aenter__()
        self.browser: Browser = await self.playwright_ctx.chromium.launch(
            executable_path=chromium_path()
        )

        # aiohttp
        self.client = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10))
        await self.client.__aenter__()

        return self

    async def __aexit__(self, exc_type, exc, tb):
        try:
            await self.browser.close()
        except Exception:
            pass

        try:
            await self.playwright.__aexit__(exc_type, exc, tb)
        except Exception:
            pass

        try:
            await self.client.__aexit__(exc_type, exc, tb)
        except Exception:
            pass
        del self._current_holder.context
