import asyncio
import re

from service.lib.context import Context
from service.lib.header import HEADERS
from service.lib.request import request_text

from .base import BaseResourceSearcher
from .maccms_player import _unwrap_embedded_url

_ART_URL_RE = re.compile(
    r'url:\s*"(https?://[^"]+\.(?:m3u8|mp4)(?:\?[^"]*)?)"',
    re.IGNORECASE,
)
_ART_URL_RE_SQ = re.compile(
    r"url:\s*'(https?://[^']+\.(?:m3u8|mp4)(?:\?[^']*)?)'",
    re.IGNORECASE,
)


class ArtplayerResourceSearcher(BaseResourceSearcher):
    """Parse `url:` inside Artplayer options from play page HTML (no browser)."""

    async def search(self, url: str, _retry: int = 3) -> str:
        html = await request_text(url, _retry)
        found = _ART_URL_RE.findall(html) or _ART_URL_RE_SQ.findall(html)
        if not found:
            raise ValueError(f"no Artplayer m3u8/mp4 url in page: {url}")
        return _unwrap_embedded_url(found[-1])
