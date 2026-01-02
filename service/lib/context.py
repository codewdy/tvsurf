from playwright.async_api import async_playwright, Playwright, Browser
from typing import AsyncContextManager
import threading
import sys
import os

def chromium_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "chrome-win64", "chrome.exe")  # type: ignore[attr-defined]
    return None


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

class Context(metaclass=ContextMeta):
    _current_holder = threading.local()

    async def __aenter__(self):
        self._current_holder.context = self
        self.playwright: AsyncContextManager[Playwright] = async_playwright()
        self.playwright_ctx: Playwright = await self.playwright.__aenter__()
        self.browser: Browser = await self.playwright_ctx.chromium.launch(executable_path=chromium_path())
        return self

    async def __aexit__(self, exc_type, exc, tb):
        try:
            await self.browser.close()
        except BaseException:
            pass
        try:
            await self.playwright.__aexit__(exc_type, exc, tb)
        except BaseException:
            pass
        del self._current_holder.context
