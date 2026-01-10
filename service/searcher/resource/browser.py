from service.lib.context import Context
from urllib.parse import urlparse, parse_qs
import asyncio
import re
from .base import BaseResourceSearcher


class RequestResourceHandler:
    def __init__(self, pattern):
        self.result = None
        self.pattern = pattern
        self.event = asyncio.Event()

    async def handle_request(self, route):
        if self.pattern.search(route.request.url):
            self.result = route.request.url
            self.event.set()
        await route.continue_()

    @staticmethod
    async def get(url, pattern):
        result = RequestResourceHandler(pattern)
        page = await Context.browser.new_page()
        await page.route("**/*", result.handle_request)
        await page.goto(url, timeout=60000)
        await page.title()
        try:
            await asyncio.wait_for(result.event.wait(), timeout=60)
            return result.result
        finally:
            await page.close()


class BrowserResourceSearcher(BaseResourceSearcher):
    def __init__(self, pattern="https?://.*\\.(mp4|m3u8)"):
        self.pattern = re.compile(pattern)

    async def search(self, url):
        video_url = await RequestResourceHandler.get(url, self.pattern)
        if video_url is None:
            raise ValueError(f"cannot get resource: {url}")
        parsed_url = urlparse(video_url)
        query_params = parse_qs(parsed_url.query)
        if "url" in query_params:
            video_url = query_params["url"][0].decode("utf-8")
        return video_url


if __name__ == "__main__":
    import sys
    import asyncio

    searcher = BrowserResourceSearcher()

    async def search_video(url):
        async with Context():
            return await searcher.search(url)

    video_url = asyncio.run(search_video(sys.argv[-1]))
    print(video_url)
