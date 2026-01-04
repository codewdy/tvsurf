from service.lib.context import Context
from service.lib.header import HEADERS
import aiohttp
from service.schema.downloader import DownloadProgress


class SimpleDownloader:
    def __init__(self, src, dst, download_tracker=None):
        self.src = src
        self.dst = dst
        self.download_tracker = download_tracker

    async def run(self):
        async with Context.client.get(
            self.src,
            headers=HEADERS,
            timeout=aiohttp.ClientTimeout(
                total=Context.config.download.connect_timeout.total_seconds()
            ),
        ) as resp:
            content_length = resp.content_length
            downloaded_size = 0
            resp.raise_for_status()
            if self.download_tracker is not None:
                if content_length is not None:
                    self.download_tracker.add_fragment(content_length)
            with open(self.dst, "wb") as f:
                while True:
                    chunk = await resp.content.read(Context.config.download.chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    if self.download_tracker is not None:
                        self.download_tracker.add_bytes_downloaded(len(chunk))
                    downloaded_size += len(chunk)
            if self.download_tracker is not None and content_length is None:
                self.download_tracker.add_fragment(downloaded_size)
