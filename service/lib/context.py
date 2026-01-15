from playwright.async_api import async_playwright, Playwright, Browser
from typing import AsyncContextManager, Any, Optional
import threading
import aiohttp
from .path import chromium_path
from .error_handler import ErrorHandler
from .logger import get_logger
from service.schema.config import Config
from service.schema.app_config import AppConfig
import os
import ssl
import certifi


class ContextMeta(type):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._current_holder = threading.local()

    @property
    def current(cls) -> "Context":
        return cls._current_holder.context

    @property
    def browser(cls) -> Browser:
        return cls.current.browser

    @property
    def client(cls) -> aiohttp.ClientSession:
        return cls.current.client

    @property
    def error_handler(cls) -> "ErrorHandler":
        return cls.current.error_handler

    def handle_error(
        cls, title: str, type: str = "error", rethrow: bool = False
    ) -> Any:
        return cls.current.error_handler.handle_error_context(
            title, type, rethrow=rethrow
        )

    def info(cls, msg: str, *args: Any, **kwargs: Any) -> None:
        cls.current.logger.info(msg, *args, **kwargs)

    def debug(cls, msg: str, *args: Any, **kwargs: Any) -> None:
        cls.current.logger.debug(msg, *args, **kwargs)

    def error(cls, msg: str, *args: Any, **kwargs: Any) -> None:
        cls.current.logger.error(msg, *args, **kwargs)

    def warning(cls, msg: str, *args: Any, **kwargs: Any) -> None:
        cls.current.logger.warning(msg, *args, **kwargs)

    def has_data(cls, name: str) -> bool:
        return name in cls.current.data

    def data(cls, name: str) -> Any:
        return cls.current.data[name]

    def set_data(cls, name: str, d: Any) -> None:
        cls.current.data[name] = d

    def set_config(cls, config: Config) -> None:
        cls.current.config = config

    @property
    def config(cls) -> Config:
        return cls.current.config

    @property
    def app_config(cls) -> AppConfig:
        return cls.current.app_config


class Context(metaclass=ContextMeta):
    _current_holder = threading.local()

    def __init__(
        self,
        app_config: AppConfig | None = None,
    ):
        self.config = Config()
        self.app_config = app_config or AppConfig()
        os.makedirs(self.app_config.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.app_config.data_dir, "log"), exist_ok=True)
        self.logger = get_logger(
            "INFO",
            os.path.join(self.app_config.data_dir, "log/log.txt"),
            7,
        )
        self.error_handler = ErrorHandler()
        self.error_handler.add_handler(
            "error", lambda title, error: self.logger.error(f"{title}: {error}")
        )
        self.error_handler.add_handler(
            "critical", lambda title, error: self.logger.critical(f"{title}: {error}")
        )
        self.data = {}

    async def __aenter__(self) -> "Context":
        self._current_holder.context = self

        # playwright
        self.playwright: AsyncContextManager[Playwright] = async_playwright()
        self.playwright_ctx: Playwright = await self.playwright.__aenter__()
        self.browser: Browser = await self.playwright_ctx.chromium.launch(
            executable_path=chromium_path(),
            chromium_sandbox=False,
        )

        # aiohttp
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        self.client = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(ssl=ssl_context),
        )  # type: ignore
        await self.client.__aenter__()

        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc: Optional[BaseException],
        tb: Any,
    ) -> None:
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
